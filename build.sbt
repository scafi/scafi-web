import sbt.Keys.target
// Constants
val scalaProjectVersion = "2.12.10"
val scalaTestVersion = "3.1.1"
val scafiVersion = "1.1.0"

inThisBuild(
  List(
    sonatypeProfileName := "it.unibo.scafi", // Your profile name of the sonatype account
    publishMavenStyle := true, // ensure POMs are generated and pushed
    Test / publishArtifact := false,
    pomIncludeRepository := { _ => false }, // no repositories show up in the POM file
    licenses := Seq("Apache-2.0" -> url("https://www.apache.org/licenses/LICENSE-2.0")),
    homepage := Some(url("https://scafi.github.io/web")),
    resolvers += Resolver.sonatypeRepo("snapshots"),
    scmInfo := Some(
      ScmInfo(
        url("https://github.com/scafi/scafi-web"),
        "scm:git:git@github.org:scafi/scafi-web.git"
      )
    ),
    developers := List(
      Developer(
        id = "metaphori",
        name = "Roberto Casadei",
        email = "roby.casadei@unibo.it",
        url = url("http://robertocasadei.apice.unibo.it")
      ),
      Developer(
        id = "cric96",
        name = "Gianluca Aguzzi",
        email = "gianluca.aguzzi@unibo.it",
        url = url("https://cric96.github.io/")
      )
    ),
    releaseEarlyWith := SonatypePublisher,
    publishTo := Some(
      if (isSnapshot.value) Opts.resolver.sonatypeSnapshots else Opts.resolver.sonatypeStaging
    ),
    scalaVersion := scalaProjectVersion // default version
  )
)

lazy val compileScalastyle = taskKey[Unit]("compileScalastyle")

lazy val commonSettings = Seq(
  organization := "it.unibo.scafi",
  compileScalastyle := (Compile / scalastyle).toTask("").value,
  Compile / compile := ((Compile / compile) dependsOn compileScalastyle).value
)

lazy val noPublishSettings = Seq(
  publishArtifact := false,
  publish := {},
  publishLocal := {}
)

lazy val `scafi-web` = project
  .in(file("."))
  .enablePlugins(ScalaUnidocPlugin)
  .aggregate(frontend)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    packagedArtifacts := Map.empty,
    crossScalaVersions := Nil,
    unidocProjectFilter in (ScalaUnidoc, unidoc) := inAnyProject
  )

lazy val frontend = project
  .enablePlugins(ScalaJSBundlerPlugin)
  // .dependsOn(commonsCross.js, coreCross.js, simulatorCross.js)
  .settings(
    name := "frontend",
    scalaJSUseMainModuleInitializer := true,
    libraryDependencies ++= Seq(
      "org.scala-js" %%% "scalajs-dom" % "1.0.0",
      "org.scalatest" %%% "scalatest" % "3.2.0" % "test",
      "com.lihaoyi" %%% "scalatags" % "0.9.1",
      "com.lihaoyi" %%% "upickle" % "2.0.0",
      "com.github.japgolly.scalacss" %%% "ext-scalatags" % "0.6.1",
      "io.monix" %%% "monix-reactive" % "3.2.2",
      "org.querki" %%% "jquery-facade" % "2.0",
      "it.unibo.scafi" %%% "scafi-core" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-commons" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-simulator" % scafiVersion
    ),
    installJsdom / version := "12.0.0",
    Test / requireJsDomEnv := true,
    webpackBundlingMode := BundlingMode
      .LibraryAndApplication(), // https://scalacenter.github.io/scalajs-bundler/cookbook.html#several-entry-points
    Compile / npmDependencies ++= Seq(
      "bootstrap" -> "4.6.0",
      "codemirror" -> "5.59.2",
      "@fortawesome/fontawesome-free" -> "5.15.2",
      "jquery" -> "3.5.1",
      "jquery-resizable-dom" -> "0.35.0",
      "phaser" -> "3.24.1",
      "simplebar" -> "6.0.0-beta.3",
      "split.js" -> "1.6.2",
      // webpack dependecies
      "webpack-merge" -> "4.1.2",
      "imports-loader" -> "0.8.0",
      "expose-loader" -> "0.7.5",
      "css-loader" -> "4.2.1",
      "style-loader" -> "1.2.1"
    ),
    webpackConfigFile := Some(baseDirectory.value / "src" / "main" / "resources" / "dev.webpack.config.js"),
    Test / webpackConfigFile := Some(baseDirectory.value / "src" / "test" / "resources" / "test.webpack.config.js")
  )
