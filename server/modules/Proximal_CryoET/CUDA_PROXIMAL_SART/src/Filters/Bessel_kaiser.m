function weight = Bessel_kaiser(a, alpha, r)
    %Alpha is taper parameter that determines tradeoff between width of main lobe and amplitude of side lobes
    %Alpha = 0, we get box function of width 2a
    %m is the order of modified bessel function. Set to 2 to get continuous
    %derivative at kernel border and kernel's extent
    
    %
    %a = 2;
    m = 2;
    %alpha = 10.4;     
    weight = (a*sqrt(2*pi/alpha)/besseli(m,alpha))*(((sqrt(1-(r/a)^2))^(m+0.5))*(besseli(m+0.5,alpha*sqrt(1-(r/a)^2))));
end


%To generate kernel:
% clear
% a = 2;
% alpha = 10.6;
% x = 0:0.0001:2;
% y = x;
% for i = 1:length(y)
%     y(i) = Bessel_kaiser(a, alpha, x(i));
% end;
% plot(x,y);
% xlabel('distance (voxels)');
% ylabel('Weigth');
% title("Bessel-Kaiser");
% y = transpose(y);


%To analyze frequency domain
% clear
% close all
% a = 2;
% alpha = 10.6;
% period = 0.0001; %Period of sampling, in voxels
% x = -2:period:2;
% fs = 1/period;
% for i = 1:length(x)
%     y(i) = Bessel_kaiser(a, alpha, x(i));
% end;
% plot(x,y);
% xlabel('distance (voxels)');
% ylabel('Weigth');
% title("Spatial Bessel-Kaiser filter kernel");
% n = 10*2^nextpow2(length(x)); %To use the fft function to convert the signal to the frequency domain, first identify a new input length that is the next power of 2 from the original signal length. This will pad the signal X with trailing zeros in order to improve the performance of fft.
% Y = fft(y,n);
% f = fs*(0:(n/2))/n;
% P = abs(Y/n).^2;
% figure
% plot(f(1:130),mag2db(P(1:130)/P(1))) % plot(f,P(1:n/2+1)) 
% title('Bessel-Kaiser kernel in frequency domain')
% xlabel('Frequency (f)')
% ylabel('Relative power (dB)')