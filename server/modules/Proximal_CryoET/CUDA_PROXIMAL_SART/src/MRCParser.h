#pragma once

#include <fstream>
#include <thread>
#include <vector>
#include <string>

using std::string;
using std::vector;

//Pause regardless of OS
void _pause()
{
#ifdef _WIN32
	system("pause");
#else
	printf("Press enter to continue..."); getchar(); printf("\n");
#endif
}

class MRCParser
{
    
public:

    int load_original(string fileName);	
	//void exportHeader(QString filename);

	//Returns size of given axis
	//dimensions(0) returns size x and so on
	int dimensions(int d)
	{
		switch (d)
		{
		case 0:
			return this->nx;
			break;
		case 1:
			return this->ny;
			break;
		case 2:
			return this->nz;
			break;		
		default:
			return 0;
			break;
		}
	}

	float* getData()
	{
		return this->fdata;
	}

	//Stores dmin, dmax, dmean in
	//min max mean
	void getmmm(float &min, float &max, float &mean)
	{
		min = this->dmin;
		max = this->dmax;
		mean = this->dmean;
	}

private:
	int nx, ny, nz; //Dimensions
	int mode;
	int nxstart, nystart, nzstart;
	int mx, my, mz;
	float cellsx, cellsy, cellsz;
	float alpha, beta, gamma;
	int mapc, mapr, maps;
	float dmin, dmax, dmean; //Min, max, and mean values from data
	int spacegroup;
	int extheader;	
	float x, y, z;
	int machst;
	float rms;
	string exttyp;
	int version;
	vector<string> labels;	

	float* fdata; //Pointer to the MRC's data
	int fdataLength; 
};


//Saves host data object with dimension dim
//name requries extension .mrc
//ISPG = 0 for 2D stacks, 1 for volumes
void smrc(std::string filepath, float* data, uint3 dim, int ISPG = 1, float min = 0, float max = 0, float mean = 0)
{
	//Open binary(!!) file
	FILE * file = fopen(filepath.c_str(), "wb");

	if (file == NULL)
	{
		printf("Error creating MRC file.\n");
		_pause();
		fclose(file);
	}

	int data_size = dim.x*dim.y*dim.z;

	//nx, ny, nz
	int d[3] = {dim.x, dim.y, dim.z};
	fwrite(d, 4, 3, file);
	//fwrite((const void*)dim.x, 4, 1, file);
	//fwrite((const void*)dim.y, 4, 1, file);
	//fwrite((const void*)dim.z, 4, 1, file);

	//MODE 2 for float data
	int dos[1] = {2};
	fwrite(dos, 4, 1, file);

	//NX, NY, NZ start
	int zero[1] = {0};
	for (int i = 0; i < 3; i++) {
		fwrite(zero, 4, 1, file);
	}

	//MX = ?
	//fwrite(&dim.x, 4, 1, file);
	//MY = ?
	//fwrite(&dim.y, 4, 1, file);
	//MZ = 1
	//fwrite(&dim.z, 4, 1, file);
	fwrite(d, 4, 3, file);

	//CELLX	
	fwrite(zero, 4, 1, file);
	//CELLY
	fwrite(zero, 4, 1, file);
	//CELLZ
	fwrite(zero, 4, 1, file);

	//alpha
	float f[1] = {90.0f};
	fwrite(f, 4, 1, file);
	//beta
	fwrite(f, 4, 1, file);
	//gamma
	fwrite(f, 4, 1, file);

	//MAPC
	int udt[3] = {1, 2, 3};
	//fwrite((const void*)1, 4, 1, file);
	//MAPR
	//fwrite((const void*)2, 4, 1, file);
	//MAPS
	//fwrite((const void*)3, 4, 1, file);
	fwrite(udt, 4, 3, file);

	//DMIN
	f[0] = min;
	fwrite(f, 4, 1, file);

	//DMAX
	f[0] = max;
	fwrite(f, 4, 1, file);

	//DMEAN
	f[0] = mean;
	fwrite(f, 4, 1, file);

	//ISPG = 1 for Single EM/ET volumes
	int ispg[1] = {ISPG};
	fwrite(ispg, 4, 1, file);

	//NSYMBT size of extended header
	fwrite(zero, 4, 1, file);

	//EXTRA
	for (int i = 0; i < 25; i++)
	{
		if (i == 2)
		{
			//EXTTYP
			char exttyp[4] = { 'J', 'R', 'Z', 'L' };
			fwrite(exttyp, 1, 4, file);
		}
		else if (i == 3)
		{
			//NVERSION
			int nver[1] = {0715};
			fwrite(nver, 4, 1, file);
		}
		else
		{
			fwrite(zero, 4, 1, file);
		}			
	}

	//ORIGIN
	for (int i = 0; i < 3; i++) {
		fwrite(zero, 4, 1, file);
	}

	//MAP
	char map[4] = {'M', 'A', 'P', ' '};
	fwrite(map, 1, 4, file);

	//MACHST
	//0x44 0x44 0x00 0x00 for little endian machines, and 0x11 0x11 0x00 0x00 for big endian machines
	char MACHST[4] = { (char)'DD', (char)'DD', '\0', '\0' }; //Little endian
	fwrite(MACHST, 1, 4, file);

	//RMS
	float rms[1] = {9.98f};
	fwrite(rms, 4, 1, file);

	//NLABL = 0
	int diez[1] = {0};
	fwrite(diez, 4, 1, file);

	//Write 10 80-char labels.
	unsigned char c[1] = {' '};
	for (int i = 0; i < 800; i++)
	{
		fwrite(c, 1, 1, file);
	}

	float dd[1];
	for (int i = 0; i < data_size; i++)
	{
		dd[0] = data[i];
		fwrite(dd, 4, 1, file);
	}

	fclose(file);
}
