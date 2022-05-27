#!/usr/bin/env bash

cp ./online-compiler/target/scala-2.12/online-compiler.jar ./online-compiler/src/resources/online-compiler.jar
cd ./online-compile/src/resources
docker build -t gianlucaaguzzi/scafi-web:$GITHUB_REF .   
docker push gianlucaaguzzi/scafi-web:$GITHUB_REF
docker tag gianlucaaguzzi/scafi-web:$GITHUB_REF gianlucaaguzzi/scafi-web:latest 
docker push gianlucaaguzzi/scafi-web:$GITHUB_REF
