package it.unibo.scafi.compiler
//old way, reload the entire page
object ScalaCompiledPage {
  def html(scriptId: String): String =
    s"""<!DOCTYPE html>
      |<html>
      |<head>
      |    <meta charset="UTF-8">
      |    <title>Scafi</title>
      |</head>
      |<body>
      |    <script id="scafiWeb" type="text/javascript" src="/js/$scriptId"></script>
      |    <script>
      |     Injector.main() //needed for run program injected
      |    </script>
      |</body>
      |</html>""".stripMargin
}
