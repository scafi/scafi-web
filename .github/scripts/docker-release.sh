#!/usr/bin/env bash

cp ./online-compiler/target/scala-2.12/online-compiler.jar ./online-compiler/src/main/resources/online-compiler.jar
cd ./online-compile/src/main/resources
TAG=${GITHUB_REF##*/}
docker build -t gianlucaaguzzi/scafi-web:$TAG .   
docker push gianlucaaguzzi/scafi-web:$TAG
docker tag gianlucaaguzzi/scafi-web:$TAG gianlucaaguzzi/scafi-web:latest 
docker push gianlucaaguzzi/scafi-web:$TAG
