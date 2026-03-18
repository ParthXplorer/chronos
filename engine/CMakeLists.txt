cmake_minimum_required(VERSION 3.16)
project(ChronosEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Release build: fast, no debug symbols
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

set(CMAKE_CXX_FLAGS_RELEASE "-O2 -DNDEBUG")

include_directories(include)

add_executable(chronos_engine
    src/main.cpp
    src/MatchingEngine.cpp
)

# Warn aggressively during development
target_compile_options(chronos_engine PRIVATE
    -Wall -Wextra -Wpedantic
)

# Optional: install target for CI/CD
install(TARGETS chronos_engine DESTINATION bin)