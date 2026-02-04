import torch
import torch.nn.functional as F
import torch.nn as nn

def normalized_relu(x, inplace=True):
    x = F.relu(x, inplace=inplace)
    return x / (x.max() + torch.finfo(x.dtype).eps)

class NormalizedReLU(nn.Module):
    def __init__(self, inplace=True):
        super().__init__()
        self.inplace = inplace
    def forward(self, x):
        return normalized_relu(x, self.inplace)

class AdaptiveWingLoss(nn.Module):
    def __init__(self, omega=14, theta=0.5, epsilon=1, alpha=2.1):
        ''' Adaptive Wing Loss. See https://arxiv.org/pdf/1904.07399.pdf
        Implementation from https://github.com/elliottzheng/AdaptiveWingLoss/blob/master/adaptive_wing_loss.py

        Args:
            omega (int, optional): Increases influence on small errors (not very sensitive). Defaults to 14.
            theta (float, optional): Threshold for |p-t| to decide which loss to use (linear vs. nonlinear). Defaults to 0.5.
            epsilon (int, optional): Balances omega (not very sensitive). Defaults to 1.
            alpha (float, optional): Controls exponent to shift between MSE and MAE. Defaults to 2.1.
        '''
        super(AdaptiveWingLoss, self).__init__()
        self.omega = omega
        self.theta = theta
        self.epsilon = epsilon
        self.alpha = alpha

    def forward(self, pred, target):
        '''
        :Args:
            pred (torch.Tensor): Prediction. Shape must be more than 1D, same as `target`
            target (torch.Tensor): Target. Shape must be more than 1D, same as `pred`
        '''

        y = target
        y_hat = pred
        delta_y = (y - y_hat).abs()
        delta_y1 = delta_y[delta_y < self.theta]
        delta_y2 = delta_y[delta_y >= self.theta]
        y1 = y[delta_y < self.theta]
        y2 = y[delta_y >= self.theta]
        loss1 = self.omega * torch.log(1 + torch.pow(
            delta_y1 / self.omega, self.alpha - y1))
        A = self.omega * (1 / (1 + torch.pow(self.theta / self.epsilon, self.alpha - y2))) * (self.alpha - y2) * (
            torch.pow(self.theta / self.epsilon, self.alpha - y2 - 1)) * (1 / self.epsilon)
        C = self.theta * A - self.omega * torch.log(1 + torch.pow(self.theta / self.epsilon, self.alpha - y2))
        loss2 = A * delta_y2 - C
        return (loss1.sum() + loss2.sum()) / (len(loss1) + len(loss2))
