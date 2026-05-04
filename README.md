# ScaFi Web #
[![DOI](https://zenodo.org/badge/340867650.svg)](https://zenodo.org/badge/latestdoi/340867650)

[Demo](https://youtu.be/E-EoFmm5tuc)

[Site](https://scafi.github.io/web/)

ScaFi Web is an online playground by which is possible to experiment with ScaFi, a modern Scala toolchain for Aggregate Programming.
This project is highly inspired by ScalaFiddle and currently is under development, so both API and functionality are unstable.

Scala compilation is powered by [Scastie](https://scastie.scala-lang.org).

## How to launch ScaFi-Web locally
```
sbt "project frontend; fastOptJS::webpack"
```
Then serve the `frontend/target/scala-2.12/scalajs-bundler/main/` directory with any static file server (e.g., `npx serve`).

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
