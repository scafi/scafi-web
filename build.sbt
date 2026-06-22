import sbt.Keys.target
// Constants
val scalaProjectVersion = "2.13.16"
val scalaTestVersion = "3.2.19"
val scafiVersion = "1.8.0"

inThisBuild(
  List(
    sonatypeProfileName := "it.unibo.scafi", // Your profile name of the sonatype account
    publishMavenStyle := true, // ensure POMs are generated and pushed
    Test / publishArtifact := false,
    pomIncludeRepository := { _ => false }, // no repositories show up in the POM file
    licenses := Seq("Apache-2.0" -> url("https://www.apache.org/licenses/LICENSE-2.0")),
    homepage := Some(url("https://scafi.github.io/web")),
    resolvers ++= Resolver.sonatypeOssRepos("snapshots"),
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
      if (isSnapshot.value) Resolver.sonatypeOssRepos("snapshots").head else Opts.resolver.sonatypeStaging
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
  .aggregate(`standalone-runtime`)
  .settings(commonSettings: _*)
  .settings(noPublishSettings: _*)
  .settings(
    packagedArtifacts := Map.empty,
    crossScalaVersions := Nil,
    ScalaUnidoc / unidoc / unidocProjectFilter := inAnyProject
  )

lazy val `standalone-runtime` = project
  .enablePlugins(ScalaJSPlugin)
  .settings(
    name := "scafi-standalone-runtime",
    organization := "it.unibo.scafi",
    crossScalaVersions := Seq("2.13.16", "3.7.4"),
    libraryDependencies ++= Seq(
      "it.unibo.scafi" %%% "scafi-core" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-commons" % scafiVersion,
      "it.unibo.scafi" %%% "scafi-simulator" % scafiVersion
    ),
    Compile / sourceGenerators += Def.task {
      val templateFile = baseDirectory.value / "src" / "main" / "template" / "ScafiStandaloneRuntime.template.scala"
      val outputFile = (Compile / sourceManaged).value / "it" / "unibo" / "scafi" / "standalone" / "RuntimeTemplate.scala"
      val templateLines = scala.io.Source.fromFile(templateFile).getLines().toVector
      val escapedLines = templateLines.map { line =>
        val escaped = line
          .replace("\\", "\\\\")
          .replace("\"", "\\\"")
        if (escaped.trim == "// $$USER_CODE$$")
          "\"__USER_CODE_PLACEHOLDER__\""
        else
          "\"" + escaped + "\""
      }.mkString(",\n    ")
      val content =
        s"""package it.unibo.scafi.standalone
           |
           |object RuntimeTemplate {
           |  private val template: String = Seq[String](
           |    $escapedLines
           |  ).mkString("\\n")
           |
           |  def wrapCode(core: String): String = template.replace("__USER_CODE_PLACEHOLDER__", core)
           |}
           |""".stripMargin
      IO.createDirectory(outputFile.getParentFile)
      IO.write(outputFile, content)
      Seq(outputFile)
    }.taskValue
  )
