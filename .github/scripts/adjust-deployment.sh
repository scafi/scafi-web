#!/usr/bin/env bash
mkdir ./public
for asset in $(basename -a ./frontend/src/main/resources/*) ; do
  cp -r "./frontend/target/scala-2.12/classes/${asset}" ./public/ ;
done
mkdir -p ./public/js
cp "./frontend/target/scala-2.12/scalajs-bundler/main/frontend-opt-bundle.js" ./public/js
