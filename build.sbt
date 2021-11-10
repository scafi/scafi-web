import sbt.Keys.target
import scalajsbundler.{JSDOMNodeJSEnv, Webpack}
// Resolvers
resolvers += Resolver.sonatypeRepo("snapshots")
resolvers += Resolver.typesafeRepo("releases")
resolvers += "Local Maven" at baseDirectory.value + "/libs/"
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
val scopt = "com.github.scopt" %% "scopt" % "4.0.0-RC2"
val shapeless = "com.chuusai" %% "shapeless" % "2.3.3"
val playJson = "com.typesafe.play" %% "play-json" % "2.8.1"
val scalafx = "org.scalafx" %% "scalafx" % "12.0.2-R18"
val slf4jlog4 = "org.slf4j" % "slf4j-log4j12" % "1.7.26"
val log4 = "log4j" % "log4j" % "1.2.17"

// Determine OS version of JavaFX binaries
lazy val osName = System.getProperty("os.name") match {
  case n if n.startsWith("Linux") => "linux"
  case n if n.startsWith("Mac") => "mac"
  case n if n.startsWith("Windows") => "win"
  case _ => throw new Exception("Unknown platform!")
}

// JavaFX dependencies (Java 11)
lazy val javaFXModules = Seq("base", "controls", "graphics", "media", "swing", "web")
lazy val javaFX = if (scala.util.Try(jdkVersion.toInt).getOrElse(0) >= 11) {
  javaFXModules.map(m => "org.openjfx" % s"javafx-$m" % (jdkVersion + ".0.2") classifier osName)
} else {
  Seq()
}

lazy val javaVersion = System.getProperty("java.version").stripPrefix("openjdk")
lazy val jdkVersion = javaVersion.split('.').headOption.getOrElse(if (javaVersion.isEmpty) "11" else javaVersion)

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
  homepage := Some(url("https://scafi.github.io/")),
  scmInfo := Some(
    ScmInfo(
      url("https://github.com/scafi/scafi"),
      "scm:git:git@github.org:scafi/scafi.git"
    )
  ),
  developers := List(
    Developer(id = "metaphori", name = "Roberto Casadei", email = "roby.casadei@unibo.it", url = url("http://robertocasadei.apice.unibo.it")),
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
  pgpPublicRing := file("./.travis/local.pubring.asc"),
  pgpSecretRing := file("./.travis/local.secring.asc"),
  crossScalaVersions := scalaVersionsForCrossCompilation, // "2.13.0-M1"
  scalaVersion := crossScalaVersions.value.head, // default version
))

lazy val compileScalastyle = taskKey[Unit]("compileScalastyle")

lazy val commonSettings = Seq(
  organization := "it.unibo.apice.scafiteam",
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
  .aggregate(core, commons, spala, distributed, simulator, `simulator-gui`, `renderer-3d`, `stdlib-ext`, `tests`, `demos`,
    `simulator-gui-new`, `demos-new`, `demos-distributed`, `online-compiler`)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    // Prevents aggregated project (root) to be published
    packagedArtifacts := Map.empty,
    crossScalaVersions := Nil, // NB: Nil to prevent double publishing!
    unidocProjectFilter in(ScalaUnidoc, unidoc) := inAnyProject -- inProjects(tests, demos, `demos-new`, `demos-distributed`)
  )

lazy val commonsCross = crossProject(JSPlatform, JVMPlatform).in(file("commons"))
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-commons"
  )
  .jsSettings(
    libraryDependencies += "org.scala-js" %%% "scalajs-java-time" % "1.0.0"
  )

lazy val commons = commonsCross.jvm

lazy val coreCross = crossProject(JSPlatform, JVMPlatform).in(file("core"))
  .dependsOn(commonsCross)
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-core",
    libraryDependencies += scalatest
  )

lazy val core = coreCross.jvm

lazy val `stdlib-ext` = project
  .dependsOn(core)
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-lib-ext",
    libraryDependencies ++= Seq(scalatest, shapeless)
  )

lazy val simulatorCross = crossProject(JSPlatform, JVMPlatform).in(file("simulator"))
  .dependsOn(coreCross)
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-simulator",
    scalaJSUseMainModuleInitializer := true
  )
  .jsSettings(
    libraryDependencies += "org.scala-js" %%% "scalajs-java-time" % "1.0.0"
  )

lazy val simulator = simulatorCross.jvm

lazy val `simulator-gui` = project
  .dependsOn(core, simulator, `renderer-3d`)
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-simulator-gui",
    libraryDependencies ++= Seq(scopt),
    compileScalastyle := {}
  )

lazy val `renderer-3d` = project
  .dependsOn()
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-3d-renderer",
    libraryDependencies ++= Seq(
      scalaBinaryVersion.value match {
        case "2.13" => "org.scalafx" %% "scalafx" % "12.0.2-R18"
        case _ => "org.scalafx" %% "scalafx" % "8.0.144-R12"
      },
      scalaLogging) ++ javaFX
  )

lazy val spala = project
  .dependsOn(commons)
  .settings(commonSettings: _*)
  .settings(
    name := "spala",
    //crossScalaVersions := scalaVersionsForCrossCompilation.filter(!_.startsWith("2.13")),
    libraryDependencies ++= Seq(akkaActor, akkaRemote, bcel, scopt,
      scalaBinaryVersion.value match {
        case "2.11" => "com.typesafe.play" %% "play-json" % "2.6.9"
        case "2.12" => "com.typesafe.play" %% "play-json" % "2.8.1"
        case "2.13" => "com.typesafe.play" %% "play-json" % "2.8.1"
      }
      , slf4jlog4, log4)
  )

lazy val distributed = project
  .dependsOn(core, spala)
  .settings(commonSettings: _*)
  .settings(
    name := "scafi-distributed",
    //crossScalaVersions := scalaVersionsForCrossCompilation.filter(!_.startsWith("2.13")),
    libraryDependencies += scalatest
  )

lazy val tests = project
  .dependsOn(core, simulator)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    name := "scafi-tests",
    libraryDependencies += scalatest
  )

lazy val demos = project
  .dependsOn(core, `stdlib-ext`, simulator, `simulator-gui`)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    name := "scafi-demos",
    compileScalastyle := {}
  )

lazy val `demos-distributed` = project
  .dependsOn(core, `stdlib-ext`, distributed)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    name := "scafi-demos-distributed",
    //crossScalaVersions := scalaVersionsForCrossCompilation.filter(!_.startsWith("2.13")),
    compileScalastyle := {}
  )

lazy val `simulator-gui-new` = project
  .dependsOn(core, simulator, distributed)
  .settings(commonSettings: _*)
  .settings(
    name := "simulator-gui-new",
    //crossScalaVersions := scalaVersionsForCrossCompilation.filter(!_.startsWith("2.13")),
    libraryDependencies ++= Seq(scopt, scalatest,
      scalaBinaryVersion.value match {
        case "2.13" => "org.scalafx" %% "scalafx" % "12.0.2-R18"
        case _ => "org.scalafx" %% "scalafx" % "8.0.144-R12"
      }
    ) ++ javaFX,
    compileScalastyle := {}
  )

lazy val `demos-new` = project
  .dependsOn(core, `stdlib-ext`, distributed, simulator, `simulator-gui-new`)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    name := "scafi-demos-new",
    //crossScalaVersions := scalaVersionsForCrossCompilation.filter(!_.startsWith("2.13")),
    compileScalastyle := {}
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
      "split.js" -> "1.6.2"
    ),
    //webpack dependencies
    npmDevDependencies in Compile ++= Seq(
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
    assemblyMergeStrategy in assembly := {
      case PathList("META-INF", "MANIFEST.MF") => MergeStrategy.discard
      case "reference.conf" => MergeStrategy.concat
      case y => MergeStrategy.first
    },
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
    resolvers += "Typesafe Repo" at "https://repo.typesafe.com/typesafe/releases/",
  )

addCommandAlias("runService", ";project scafi-web; fullOptJS::webpack; project online-compiler; run")
