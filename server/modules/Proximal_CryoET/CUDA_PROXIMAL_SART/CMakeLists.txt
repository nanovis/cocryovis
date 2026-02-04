cmake_minimum_required(VERSION 3.8)

set(PROJECT_NAME CUDA_PROXIMAL_SART)

ADD_DEFINITIONS(-DUSE_CUDA)

project(${PROJECT_NAME} LANGUAGES CXX CUDA)

set(CMAKE_CONFIGURATION_TYPES Release Debug)

set(CMAKE_CXX_STANDARD 11)

if (WIN32)
	set(CUDA_TOOLKIT_ROOT_DIR "C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v11.3")
	set(CMAKE_CUDA_COMPILER ${CUDA_TOOLKIT_ROOT_DIR}/bin/nvcc.exe)
	set(CUDA_TARGET_INC ${CUDA_TOOLKIT_ROOT_DIR}/include)	
endif (WIN32)

set(SOURCES src/main.cu src/proximal_iteration.h src/linearized_admm.h src/admm.h src/primal_dual.h src/data_term_proximal_operator.h src/global_definitions.h src/kernel_functions.h src/tv_proximal_operator.h src/huber_proximal_operator.h src/NLM.h src/MRCParser.h)

add_executable(${PROJECT_NAME} ${SOURCES})

set_property(TARGET ${PROJECT_NAME} PROPERTY CUDA_ARCHITECTURES 72)

if (WIN32)
	#include directories
	target_include_directories(${PROJECT_NAME} PUBLIC src ${CUDA_TARGET_INC})

	# set link directories for libraries / dependencies
	link_directories(${CUDA_TOOLKIT_ROOT_DIR}/lib/x64)
	
	# add libraries / dependencies
	target_link_libraries(${PROJECT_NAME} cuda cudart)
endif (WIN32)

if (UNIX)
	find_package(X11 REQUIRED)
	message(STATUS "X11_FOUND = ${X11_FOUND}")
	message(STATUS "X11_INCLUDE_DIR = ${X11_INCLUDE_DIR}")
	message(STATUS "X11_LIBRARIES = ${X11_LIBRARIES}")  

	#include directories
	target_include_directories(${PROJECT_NAME} PUBLIC src ${X11_INCLUDE_DIR})

	# set link directories for libraries / dependencies
	#link_directories(${CUDA_TOOLKIT_ROOT_DIR}/lib/x64)
	link_directories(${X11_LIBRARIES})
	
	# add libraries / dependencies
	target_link_libraries(${PROJECT_NAME} cuda cudart ${X11_LIBRARIES})
endif (UNIX)