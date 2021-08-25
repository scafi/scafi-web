# ScaFi Web #
[![DOI](https://zenodo.org/badge/340867650.svg)](https://zenodo.org/badge/latestdoi/340867650)

[Demo](https://youtu.be/E-EoFmm5tuc)

[Site](https://scafi.github.io/web/)

ScaFi Web is an online playground by which is possible to experiment with ScaFi, a modern Scala toolchain for Aggregate Programming.
This project is highly inspired by ScalaFiddle and currently is under development, so both API and functionality are unstable.

This project is composed of two-part:
- a web page: developed using Scala.js, Phaser and scala-js-dom
- a remote compilation service: inspired by ScalaFiddle, it compiles remote ScaFi scripts.

## How to launch ScaFi-Web locally
ScaFi web can be easily deployed locally, using both sbt and docker
### sbt
In the root directory, type:
```
sbt
project online-compiler
compile
run
```
ScaFi web currently works only in JDK 8. So if you use a Java environment manager (like Jabba), switch to the right version before trying to launch it.
### docker
Using the latest image from [here](https://hub.docker.com/r/gianlucaaguzzi/scafi-web/tags) type:
```
docker run -t -p 8080:8080 gianlucaaguzzi/scafi-web:latest
```

## Preliminary support of ScaFi.js
ScaFi web supports also a Javascript dialect of ScaFi but currently is not mature enough to be part of the page.
If you want to experiment with it, it is possible to use with: https://scafi.github.io/web/?javascript
Main differences:
```
// rep
ScaFi: rep(init){value => ... }
ScaFi.js: return rep(() => init, value => ...)
// foldhood
ScaFi: foldhood(init)((acc, value) => ...)(nbr(...))
ScaFi.js: return foldhood(() => init), (acc, value) => ..., nbr(() => ...))
```
