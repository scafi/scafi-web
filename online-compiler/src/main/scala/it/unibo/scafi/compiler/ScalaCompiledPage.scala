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
      |    <script id="common" type="text/javascript" src="/js/common.js"></script>
      |    <script id="scafiWeb" type="text/javascript" src="/js/$scriptId"></script>
      |</body>
      |</html>""".stripMargin
}
