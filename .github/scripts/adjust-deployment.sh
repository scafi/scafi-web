#!/usr/bin/env bash
mkdir ./public
for resource in ./scafi-web/src/main/resources/* ; do
  cp "./scafi-web/target/scala-2.12/classes/${resource}" ./public/ ;
done
mkdir -p ./public/js
cp "./scafi-web/target/scala-2.12/scalajs-bundler/main/scafi-web-opt-bundle.js" ./public/js
