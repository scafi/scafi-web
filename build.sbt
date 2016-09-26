// Resolvers
resolvers += Resolver.sonatypeRepo("snapshots")
resolvers += Resolver.typesafeRepo("releases")

// Constants
val akkaVersion = "2.3.7" // NOTE: Akka 2.4.0 REQUIRES Java 8!

// Managed dependencies
val akkaActor  = "com.typesafe.akka" % "akka-actor_2.11"  % akkaVersion
val akkaRemote = "com.typesafe.akka" % "akka-remote_2.11" % akkaVersion
val bcel       = "org.apache.bcel"   % "bcel"             % "5.2"
val scalatest  = "org.scalatest"     % "scalatest_2.11"   % "2.2.4"     % "test"
val scopt      = "com.github.scopt"  % "scopt_2.11"       % "3.3.0"

// Cross-Building
crossScalaVersions := Seq("2.11.8")

// Maven publishing settings
publishArtifact in Test := false
publishMavenStyle := true        // ensure POMs are generated and pushed
publishTo := {
  val nexus = "https://oss.sonatype.org/" // OSSRH base URL
  if (isSnapshot.value)
    // Deploy to 'snapshots'
    Some("snapshots" at nexus + "content/repositories/snapshots")
  else
    // Deploy to 'releases'
    Some("releases"  at nexus + "service/local/staging/deploy/maven2")
}

// POM metadata
pomIncludeRepository := { _ => false } // no repositories show up in the POM file

pomExtra := (
  <url>http://scafi.apice.unibo.it</url>
  <licenses>
    <license>
      <name>Apache 2.0</name>
      <url>https://www.apache.org/licenses/LICENSE-2.0</url>
      <distribution>repo</distribution>
    </license>
  </licenses>
  <scm>
    <url>https://bitbucket.org/scafiteam/scafi</url>
    <connection>scm:git:git@bitbucket.org:scafiteam/scafi.git</connection>
  </scm>
  <developers>
    <developer>
      <id>metaphori</id>
      <name>Roberto Casadei</name>
      <url>http://robertocasadei.apice.unibo.it</url>
    </developer>
    <developer>
      <id>mviroli</id>
      <name>Mirko Viroli</name>
      <url>http://mirkoviroli.apice.unibo.it</url>
    </developer>
  </developers>
)

// Common settings across projects
lazy val commonSettings = Seq(
  organization := "it.unibo.apice.scafiteam",
  scalaVersion := "2.11.8"
)

// 'core' project definition
lazy val core = project.
  settings(commonSettings: _*).
  settings(
    name := "scafi-core",
    version := "0.1.0",
    libraryDependencies += scalatest
  )

// 'simulator' project definition
lazy val simulator = project.
  dependsOn(core).
  settings(commonSettings: _*).
  settings(
    version := "0.1.0",
    name := "scafi-simulator"
  )

// 'distributed' project definition
lazy val distributed = project.
  dependsOn(core).
  settings(commonSettings: _*).
  settings(
    version := "0.1.0",
    name := "scafi-distributed",
    libraryDependencies ++= Seq(akkaActor, akkaRemote, bcel, scopt)
  )

// 'tests' project definition
lazy val tests = project.
  dependsOn(core, simulator).
  settings(commonSettings: _*).
  settings(
    version := "0.1.0",
    name := "scafi-tests",
    libraryDependencies += scalatest
  )

// 'demos' project definition
lazy val demos = project.
  dependsOn(core, distributed, simulator).
  settings(commonSettings: _*).
  settings(
    version := "0.1.0",
    name := "scafi-demos"
  )
