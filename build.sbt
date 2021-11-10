import sbt.Keys.target
import scalajsbundler.{JSDOMNodeJSEnv, Webpack}
// Resolvers
resolvers += Resolver.sonatypeRepo("snapshots")
resolvers += Resolver.typesafeRepo("releases")
resolvers += "Local Maven" at baseDirectory.value.toURI.toURL + "/libs/repository"
// Constants
val scalaVersionsForCrossCompilation = Seq(/*"2.11.12",*/ "2.12.2", "2.13.1") //drop support for 2.11?
val akkaVersion = "2.5.32" // NOTE: Akka 2.4.0 REQUIRES Java 8! TODO check if it create conflicts
val scalaTestVersion = "3.1.1"
// Managed dependencies
val akkaActor = "com.typesafe.akka" %% "akka-actor" % akkaVersion
val akkaHttp = "com.typesafe.akka" %% "akka-http" % "10.2.2"
val akkaRemote = "com.typesafe.akka" %% "akka-remote" % akkaVersion
val akkaStream = "com.typesafe.akka" %% "akka-stream" % akkaVersion
val akkaLogging = "com.typesafe.akka" %% "akka-slf4j" % akkaVersion
val bcel = "org.apache.bcel" % "bcel" % "6.4.1"
val scalaLogging = "com.typesafe.scala-logging" %% "scala-logging" % "3.9.2"
val scalatest = "org.scalatest" %% "scalatest" % scalaTestVersion % "test"
val slf4jlog4 = "org.slf4j" % "slf4j-log4j12" % "1.7.26"
val log4 = "log4j" % "log4j" % "1.2.17"
/*
 * - Leverage SONATYPE_USERNAME and SONATYPE_PASSWORD for authentication in Sonatype
 * - Through sbt-dynver (via sbt-release-early), project version is dynamically set based on commit
 */
inThisBuild(List(
  sonatypeProfileName := "it.unibo.scafi", // Your profile name of the sonatype account
  publishMavenStyle := true, // ensure POMs are generated and pushed
  publishArtifact in Test := false,
  pomIncludeRepository := { _ => false }, // no repositories show up in the POM file
  licenses := Seq("Apache-2.0" -> url("https://www.apache.org/licenses/LICENSE-2.0")),
  homepage := Some(url("https://scafi.github.io/web")),
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
  //releaseEarlyEnableLocalReleases := true,
  publishTo := Some(
    if (isSnapshot.value)
      Opts.resolver.sonatypeSnapshots
    else
      Opts.resolver.sonatypeStaging
  ),
  crossScalaVersions := scalaVersionsForCrossCompilation, // "2.13.0-M1"
  scalaVersion := crossScalaVersions.value.head, // default version
))

lazy val compileScalastyle = taskKey[Unit]("compileScalastyle")

lazy val commonSettings = Seq(
  organization := "it.unibo.scafi",
  compileScalastyle := scalastyle.in(Compile).toTask("").value,
  (compile in Compile) := ((compile in Compile) dependsOn compileScalastyle).value,
  (assemblyJarName in assembly) := s"${name.value}_${CrossVersion.binaryScalaVersion(scalaVersion.value)}-${version.value}-assembly.jar",
  assemblyMergeStrategy in assembly := {
    case x =>
      val oldStrategy = (assemblyMergeStrategy in assembly).value
      oldStrategy(x)
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
      "it.unibo.scafi" %%% "scafi-core" % "0.3.4-dev",
      "it.unibo.scafi" %%% "scafi-commons" % "0.3.4-dev",
      "it.unibo.scafi" %%% "scafi-simulator" % "0.3.4-dev",
    ),
    version in installJsdom := "12.0.0",
    requireJsDomEnv in Test := true,
    webpackBundlingMode := BundlingMode.LibraryAndApplication(), // https://scalacenter.github.io/scalajs-bundler/cookbook.html#several-entry-points
    npmDependencies in Compile ++= Seq(
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
    webpackConfigFile in Test := Some(baseDirectory.value / "src" / "test" / "resources" / "test.webpack.config.js"),
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
    (Compile / compile) := ((compile in Compile) dependsOn (`scafi-web` / Compile / fullOptJS / webpack)).value,
    (Compile / resources) ++= Seq(
      (LocalProject("scafi-web") / Compile / packageBin).value,
    ),
    (Compile / resources) ++= (LocalProject("runtime1x") / Compile / managedClasspath).value.map(_.data),
    (Compile / resources) ++= (LocalProject("scafi-web") / Compile / resources).value,
  )

addCommandAlias("runService", ";project scafi-web; fullOptJS::webpack; project online-compiler; run")
