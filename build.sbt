import sbt.Keys.target
// Constants
val scalaVersionsForCrossCompilation = Seq("2.12.2", "2.13.1")
val akkaVersion = "2.5.32"
val scalaTestVersion = "3.1.1"
val scafiVersion = "0.3.3+339-43a886c1-SNAPSHOT"
// Managed dependencies
val akkaActor = "com.typesafe.akka" %% "akka-actor" % akkaVersion
val akkaHttp = "com.typesafe.akka" %% "akka-http" % "10.2.2"
val akkaRemote = "com.typesafe.akka" %% "akka-remote" % akkaVersion
val akkaStream = "com.typesafe.akka" %% "akka-stream" % akkaVersion
val akkaLogging = "com.typesafe.akka" %% "akka-slf4j" % akkaVersion
val scalaLogging = "com.typesafe.scala-logging" %% "scala-logging" % "3.9.2"
val scalatest = "org.scalatest" %% "scalatest" % scalaTestVersion % "test"

inThisBuild(List(
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
    Developer(id = "metaphori", name = "Roberto Casadei", email = "roby.casadei@unibo.it", url = url("http://robertocasadei.apice.unibo.it")),
    Developer(id = "cric96", name = "Gianluca Aguzzi", email = "gianluca.aguzzi@unibo.it", url = url("https://cric96.github.io/")),
    Developer(id = "mviroli", name = "Mirko Viroli", email = "mirko.viroli@unibo.it", url = url("http://mirkoviroli.apice.unibo.it"))
  ),
  releaseEarlyWith := SonatypePublisher,
  publishTo := Some(
    if (isSnapshot.value)
      Opts.resolver.sonatypeSnapshots
    else
      Opts.resolver.sonatypeStaging
  ),
  crossScalaVersions := scalaVersionsForCrossCompilation,
  scalaVersion := crossScalaVersions.value.head, // default version
))

lazy val compileScalastyle = taskKey[Unit]("compileScalastyle")

lazy val commonSettings = Seq(
  organization := "it.unibo.scafi",
  compileScalastyle := (Compile / scalastyle).toTask("").value,
  Compile / compile := ((Compile / compile) dependsOn compileScalastyle).value,
  assembly / assemblyJarName := s"${name.value}.jar",
  assembly / assemblyMergeStrategy := {
    case PathList("reference.conf") => MergeStrategy.concat
    case PathList("META-INF", xs @ _*) => MergeStrategy.discard
    case x => MergeStrategy.first
  }
)

lazy val noPublishSettings = Seq(
  publishArtifact := false,
  publish := {},
  publishLocal := {}
)

lazy val scafi = project.in(file("."))
  .enablePlugins(ScalaUnidocPlugin)
  .aggregate(`online-compiler`)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    // Prevents aggregated project (root) to be published
    packagedArtifacts := Map.empty,
    crossScalaVersions := Nil, // NB: Nil to prevent double publishing!
    unidocProjectFilter in(ScalaUnidoc, unidoc) := inAnyProject
  )

lazy val `scafi-web` = project
  .enablePlugins(ScalaJSBundlerPlugin)
  //.dependsOn(commonsCross.js, coreCross.js, simulatorCross.js)
  .settings(
    name := "scafi-web",
    scalaJSUseMainModuleInitializer := true,
    libraryDependencies ++= Seq(
      "org.scala-js" %%% "scalajs-dom" % "1.0.0",
      "org.scalatest" %%% "scalatest" % "3.2.0" % "test",
      "com.lihaoyi" %%% "scalatags" % "0.9.1",
      "com.github.japgolly.scalacss" %%% "ext-scalatags" % "0.6.1",
      "io.monix" %%% "monix-reactive" % "3.2.2",
      "org.querki" %%% "jquery-facade" % "2.0",
      "it.unibo.scafi" %%% "scafi-core" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-commons" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-simulator" % scafiVersion,
    ),
    installJsdom / version := "12.0.0",
    Test / requireJsDomEnv := true,
    webpackBundlingMode := BundlingMode.LibraryAndApplication(), // https://scalacenter.github.io/scalajs-bundler/cookbook.html#several-entry-points
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
    Test / webpackConfigFile := Some(baseDirectory.value / "src" / "test" / "resources" / "test.webpack.config.js"),
  )
//allow to load the dependecies
def runtimeProject(p: Project, scalaJSVersion: String): Project = {
  p.dependsOn(`scafi-web`).settings(
    libraryDependencies ++= Seq(
      "org.scala-js" %% "scalajs-library" % scalaJSVersion,
      "org.scala-lang" % "scala-reflect" % scalaVersion.value,
      "org.scala-js" %% "scalajs-library" % scalaJSVersion,
      "org.scala-js" % "scalajs-compiler" % scalaJSVersion cross CrossVersion.full,
      "org.scala-js" %% "scalajs-linker" % scalaJSVersion,
    ),
    crossScalaVersions := scalaVersionsForCrossCompilation
  )
}
lazy val runtime1x = runtimeProject(project, scalaJSVersion)

lazy val `online-compiler` = project.
  enablePlugins(JavaAppPackaging).
  dependsOn(runtime1x).
  settings(
    commonSettings,
    libraryDependencies ++= Seq(
      "io.get-coursier" %% "coursier" % "1.0.3",
      "ch.megard" %% "akka-http-cors" % "1.1.1",
      "com.lihaoyi" %% "upickle" % "0.4.4",
      "io.get-coursier" %% "coursier-cache" % "1.0.3",
      "org.apache.maven" % "maven-artifact" % "3.3.9",
      "org.xerial.snappy" % "snappy-java" % "1.1.2.6",
      "org.xerial.larray" %% "larray" % "0.4.0",
      "net.logstash.logback" % "logstash-logback-encoder" % "5.0", //logging
      "ch.qos.logback" % "logback-classic" % "1.2.3", //logging
      akkaLogging, akkaHttp, akkaActor, akkaStream
    ),
    scalacOptions ++= Seq(
      "-Xlint",
      "-unchecked",
      "-deprecation",
      "-feature",
    ),
    Compile / resourceGenerators += (Def.task {
      // store build a / version property file
      val file = (Compile / resourceManaged).value / "version.properties"
      val contents =
        s"""
           |version=${version.value}
           |scalaVersion=${scalaVersion.value}
           |scalaJSVersion=$scalaJSVersion
           |""".stripMargin
      IO.write(file, contents)
      Seq(file)
    } dependsOn (Compile / compile)).taskValue,
    Compile / resourceGenerators += (Def.task {
      val major = scalaVersion.value.take(4) //works only for scala version > 10
      IO.listFiles(
        (LocalProject("scafi-web") / Compile / target).value / s"scala-${major}" / "scalajs-bundler" / "main"
      ).toSeq.filter(file => file.getName.contains("scafi-web-opt-bundle"))
    } dependsOn (Compile / compile)).taskValue,
    Compile / compile := ((Compile / compile) dependsOn (`scafi-web` / Compile / fullOptJS / webpack)).value,
    Compile / resources ++= Seq(
      (LocalProject("scafi-web") / Compile / packageBin).value,
    ),
    Compile / resources ++= (LocalProject("runtime1x") / Compile / managedClasspath).value.map(_.data),
    Compile / resources ++= (LocalProject("scafi-web") / Compile / resources).value,
  )

addCommandAlias("runService", ";project scafi-web; fullOptJS::webpack; project online-compiler; run")
