import math
import numpy as np
from scipy import ndimage, stats

def rotMatX(degrees):
    """
    Generates rotation matrix around X axis
    
    Parameters
    ----------
        degrees : angle to rotate in degrees
    
    Returns
    ----------
        rot_mat: rotation matrix    
    """
    degrees = degrees * math.pi / 180 # To radians
    return np.array([[1.0, 0.0, 0.0], 
                     [0.0, math.cos(degrees), -math.sin(degrees)],
                     [0.0, math.sin(degrees), math.cos(degrees)]])

def rotMatY(degrees):
    """
    Generates rotation matrix around Y axis
    
    Parameters
    ----------
        degrees : angle to rotate in degrees
    
    Returns
    ----------
        rot_mat: rotation matrix    
    """
    degrees = degrees * math.pi / 180 # To radians
    return np.array([[math.cos(degrees), 0.0, math.sin(degrees)], 
                     [0.0, 1.0, 0.0],
                     [-math.sin(degrees), 0.0, math.cos(degrees)]])

def rotMatZ(degrees):
    """
    Generates rotation matrix around Z axis
    
    Parameters
    ----------
        degrees : angle to rotate in degrees
    
    Returns
    ----------
        rot_mat: rotation matrix    
    """
    degrees = degrees * math.pi / 180 # To radians
    return np.array([[math.cos(degrees), -math.sin(degrees), 0.0], 
                     [math.sin(degrees), math.cos(degrees), 0.0],
                     [0.0, 0.0, 1.0]])

def rotateZXZ(tensor, tdrot, tilt, narot):
    """
    Rotates 3D tensor around Euler ZXZ angles in degrees
    
    Parameters
    ----------
        tensor : numpy 3D tensor to rotate
        tdrot: first rotation around Z axis in degrees
        tilt: rotation around X axis in degrees
        narot: second rotation around Z axis in degrees
    
    Returns
    ----------
        tensorR: rotated numpy tensor    
    """
    tensorR = ndimage.rotate(tensor, tdrot, axes=(0, 1), reshape=False) # Z
    tensorR = ndimage.rotate(tensorR, tilt, axes=(1, 2), reshape=False) # X
    tensorR = ndimage.rotate(tensorR, narot, axes=(0, 1), reshape=False) # Z
    return tensorR

# FIXME: This implementation should be incorrect!
def randomRot(vol, tdrot, tilt, narot):
    """
    Updates ZXZ rotation with rotations around X, Y or Z axis
    
    Parameters
    ----------
        vol : volume to rotate
        tdrot : starting first rotation around Z
        tilt : starting first rotation around X
        narot : starting second rotation around Z
    
    Returns
    ----------
        vo, tdrot, tilt, narot: updated and rotated all values    
    """
    possible_rot = [0, 1, 2, 3]
    euler_rot_mat = eulerToMat(tdrot, tilt, narot) 

    # Rot x
    num_rot = np.random.choice(possible_rot)
    vol = np.rot90(vol, k=num_rot, axes=(1, 2))
    euler_rot_mat = rotMatX(90 * num_rot) @ euler_rot_mat

    # Rot y
    num_rot = np.random.choice(possible_rot)
    vol = np.rot90(vol, k=num_rot, axes=(0, 2))
    euler_rot_mat = rotMatY(90 * num_rot) @ euler_rot_mat

    # Rot z
    num_rot = np.random.choice(possible_rot)
    vol = np.rot90(vol, k=num_rot, axes=(0, 1))
    euler_rot_mat = rotMatZ(90 * num_rot) @ euler_rot_mat

    tdrot, tilt, narot = matToEuler(euler_rot_mat)

    return vol, tdrot, tilt, narot

def gen3DGaussBlob(shape, mu, sigma):
    """
    Generates 3D gaussian blob
    
    Parameters
    ----------
        shape : numpy array specifying output shape
        mu: mean value per dimension
        sigma: standard deviation per dimension
    
    Returns
    ----------
        blob: generted 3D gaussian blob
    """
    x, y, z = np.mgrid[-1.0:1.0:complex(shape[0]), -1.0:1.0:complex(shape[1]), -1.0:1.0:complex(shape[2])]
    xyz = np.column_stack([x.flat, y.flat, z.flat]) # Need an (N, 3) array of (x, y, z) pairs

    covariance = np.diag(sigma**2)

    blob = stats.multivariate_normal.pdf(xyz, mean=mu, cov=covariance)
    blob = blob.reshape(x.shape)
    blob = blob / np.max(blob)

    return blob

def genElipseBlob(shape, a, c):
    """
    Generates elipsoid blob
    
    Parameters
    ----------
        shape : numpy array specifying output shape
        a: width and height of the elipse
        c: depth of the elipse
    
    Returns
    ----------
        blob: generted elipsoid blob
    """
    C = np.floor((shape[0]/2, shape[1]/2, shape[2]/2))
    x,y,z = np.meshgrid(range(shape[0]), range(shape[1]), range(shape[2]))

    blob = ((x - C[0]) / a) ** 2 + ((y - C[1]) / a) ** 2 + ((z - C[2]) / c) ** 2 
    blob = np.int8(blob <= 1)

    return blob

def boundaryCheck(x, y, z, vol_dim, patch_dim):
    """
    Guarantees patch to be inside volume
    
    Parameters
    ----------
        x, y, z : patch center
        vol_dim: dimension of volume
        patch_dim: dimension of patch
    
    Returns
    ----------
        x, y, z: center inside volume
    """
    half_patch = int(patch_dim / 2)

    if (x < half_patch) : x = half_patch
    if (y < half_patch) : y = half_patch
    if (z < half_patch) : z = half_patch
    if (x > vol_dim[2] - half_patch): x = vol_dim[2] - half_patch
    if (y > vol_dim[1] - half_patch): y = vol_dim[1] - half_patch
    if (z > vol_dim[0] - half_patch): z = vol_dim[0] - half_patch

    return x, y, z

def offsetPosition(x, y, z, shift):
    """
    Random offset in shift range
    
    Parameters
    ----------
        x, y, z : original cordinates
        shift: maximal shift 
    
    Returns
    ----------
        x, y, z: shifted cordinates
    """
    half_shift = int(shift / 2)

    x = x + np.random.choice(range(-half_shift, half_shift + 1))
    y = y + np.random.choice(range(-half_shift, half_shift + 1))
    z = z + np.random.choice(range(-half_shift, half_shift + 1))
 
    return x, y, z

def eulerToMatDeg(tdrot_deg, tilt_deg, narot_deg):
    """
    Converts euler angles in degrees to rotation matrix
    
    Parameters
    ----------
        tdrot_deg: first rotation around Z axis in degrees
        tilt_deg: rotation around X axis in degrees
        narot_deg: second rotation around Z axis in degrees
    
    Returns
    ----------
        euler_mat: euler rotation matrix
    """
    tdrot = tdrot_deg * math.pi / 180
    tilt = tilt_deg * math.pi / 180
    narot = narot_deg * math.pi / 180

    return eulerToMat(tdrot, tilt, narot)

def eulerToMat(tdrot, tilt, narot):
    """
    Converts euler angles in radians to rotation matrix
    
    Parameters
    ----------
        tdrot_deg: first rotation around Z axis in radians
        tilt_deg: rotation around X axis in radians
        narot_deg: second rotation around Z axis in radians
    
    Returns
    ----------
        euler_mat: euler rotation matrix
    """

    costdrot = math.cos(tdrot);
    cosnarot = math.cos(narot);
    costilt  = math.cos(tilt);
    sintdrot = math.sin(tdrot);
    sinnarot = math.sin(narot);
    sintilt  = math.sin(tilt);

    meuler = np.zeros(shape=(3, 3), dtype=np.float32)
    meuler[0,0] = costdrot * cosnarot - sintdrot * costilt * sinnarot
    meuler[0,1] = - cosnarot * sintdrot - costdrot * costilt * sinnarot
    meuler[0,2] = sinnarot * sintilt
    meuler[1,0] = costdrot * sinnarot + cosnarot * sintdrot * costilt
    meuler[1,1] = costdrot * cosnarot * costilt - sintdrot * sinnarot
    meuler[1,2] = -cosnarot * sintilt
    meuler[2,0] = sintdrot * sintilt
    meuler[2,1] = costdrot * sintilt
    meuler[2,2] = costilt

    return meuler.transpose()

def matToEulerDeg(R):
    """
    Converts rotation matrix to euler angles in degrees
    
    Parameters
    ----------
        R: rotation matrix
    
    Returns
    ----------
        tdrot: first rotation around Z axis in degrees
        tilt: rotation around X axis in degrees
        narot: second rotation around Z axis in degrees
    """
    tdrot, tilt, narot = matToEuler(R)

    # Convert to degrees
    tdrot = tdrot * 180 / math.pi
    tilt = tilt * 180 / math.pi
    narot = narot * 180 / math.pi

    return tdrot, tilt, narot


def matToEuler(R):
    """
    Converts rotation matrix to euler angles in degrees
    
    Parameters
    ----------
        R: rotation matrix
    
    Returns
    ----------
        tdrot: first rotation around Z axis in degrees
        tilt: rotation around X axis in degrees
        narot: second rotation around Z axis in degrees
    """

    # First valid solution: 0 < tilt < math.pi
    tdrot = math.atan2(R[0, 2], R[1, 2])
    tilt = math.acos(R[2, 2])
    narot = math.atan2(R[2, 0], -R[2, 1])

    # # Second valid solution: math.pi < tilt < 2 * math.pi
    # tdrot = math.atan2(-R[0, 2], -R[1, 2])
    # tilt = math.acos(R[2, 2])
    # narot = math.atan2(-R[2, 0], R[2, 1])

    return tdrot, tilt, narot

def normalizeVol(vol):
    """
    Normalize volume
    
    Parameters
    ----------
        vol: numpy 3d tensor
    """
    min_val = np.min(vol)
    max_val = np.max(vol)
    return (vol - min_val) / (max_val - min_val) 