package it.unibo.scafi.js.view

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

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
  @JSImport("bootstrap-css-only/css/bootstrap.min.css", JSImport.Namespace)
  object Bootstrap extends js.Any
  Bootstrap
}
