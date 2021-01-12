package it.unibo.scafi.js.view

import scalacss.defaults.Exports
import scalacss.internal.mutable.Settings

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

package object static {
  //TODO improve this setting
  val CssSettings: Exports with Settings = scalacss.DevDefaults

  /* all static import for scala.js */
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

  //simple bar style
  @js.native
  @JSImport("simplebar/dist/simplebar.css", JSImport.Namespace)
  object SimpleBarCSS extends js.Any

  SimpleBarCSS

  //code mirror javascript style
  @js.native
  @JSImport("codemirror/mode/javascript/javascript.js", JSImport.Namespace)
  object JavascriptStyle extends js.Any

  JavascriptStyle

  //code mirror javascript style
  @js.native
  @JSImport("codemirror/mode/clike/clike.js", JSImport.Namespace)
  object CLikeStyle extends js.Any

  CLikeStyle

  /*  JAVASCRIPT LIB */
  //bootstrap and popper
  @js.native
  @JSImport("bootstrap/dist/js/bootstrap.bundle.js", JSImport.Namespace)
  object Bootstrap extends js.Any

  Bootstrap

  //bootstrap util
  @js.native
  @JSImport("bootstrap/js/dist/util.js", JSImport.Namespace)
  object UtilBootstrap extends js.Any

  UtilBootstrap

  //phaser lib
  @js.native
  @JSImport("phaser", JSImport.Namespace)
  object PhaserGlobal extends js.Any //global import phaser
  PhaserGlobal
}
