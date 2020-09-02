package it.unibo.scafi.js.view

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExportAll, JSExportTopLevel, JSImport}
package object static {
  //TODO improve this setting
  val CssSettings = scalacss.DevDefaults
  /* all static import for scala.js */
  //code mirror javascript style
  @js.native
  @JSImport("codemirror/mode/javascript/javascript.js", JSImport.Namespace)
  object JavascriptStyle extends js.Any
  JavascriptStyle
  /*CSS*/
  //code mirror css
  @js.native
  @JSImport("codemirror/lib/codemirror.css", JSImport.Namespace)
  object CodeMirrorStyle extends js.Any
  CodeMirrorStyle
  //bootstrap css style
  @js.native
  @JSImport("bootstrap/dist/css/bootstrap.min.css", JSImport.Namespace)
  object BootstrapCSS extends js.Any
  BootstrapCSS
  //jquery
  import org.querki.jquery._
  @js.native
  @JSImport("jquery", JSImport.Namespace)
  object jQuery extends js.Any
  //bootstrap and popper
  @js.native
  @JSImport("bootstrap/dist/js/bootstrap.bundle.js", JSImport.Namespace)
  object Bootstrap extends js.Any
  Bootstrap
  //phaser lib
  @js.native
  @JSImport("phaser", JSImport.Namespace)
  object PhaserGlobal extends js.Any //global import phaser
  PhaserGlobal
}
