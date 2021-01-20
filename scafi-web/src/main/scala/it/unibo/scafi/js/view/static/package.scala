package it.unibo.scafi.js.view

import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import scalacss.defaults.Exports
import scalacss.internal.mutable.Settings

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

package object static {
  // ODO improve this setting
  val CssSettings: Exports with Settings = scalacss.DevDefaults

  /* all static import for scala.js */

  /*CSS*/

  // CodeMirror CSS Style
  @js.native
  @JSImport("codemirror/lib/codemirror.css", JSImport.Namespace)
  object CodeMirrorStyle extends js.Any

  CodeMirrorStyle

  // CodeMirror Material dark CSS style
  @js.native
  @JSImport("codemirror/theme/material.css", JSImport.Namespace)
  object Dark extends js.Any

  Dark

  // Bootstrap CSS style
  @js.native
  @JSImport("bootstrap/dist/css/bootstrap.min.css", JSImport.Namespace)
  object BootstrapCSS extends js.Any

  BootstrapCSS

  // SimpleBar CSS style
  @js.native
  @JSImport("simplebar/dist/simplebar.min.css", JSImport.Namespace)
  object SimpleBarCSS extends js.Any

  SimpleBarCSS

  // CodeMirror JavaScript style
  @js.native
  @JSImport("codemirror/mode/javascript/javascript.js", JSImport.Namespace)
  object JavascriptStyle extends js.Any

  JavascriptStyle

  // CodeMirror scala style
  @js.native
  @JSImport("codemirror/mode/clike/clike.js", JSImport.Namespace)
  object CLikeStyle extends js.Any

  CLikeStyle

  /*  JAVASCRIPT LIB */

  // Bootstrap and Popper.js
  @js.native
  @JSImport("bootstrap/dist/js/bootstrap.bundle.js", JSImport.Namespace)
  object Bootstrap extends js.Any

  Bootstrap

  // Bootstrap util

  /* TODO I don't remember if this has some implications, check it.
  @js.native
  @JSImport("bootstrap/js/dist/util.js", JSImport.Namespace)
  object UtilBootstrap extends js.Any

  UtilBootstrap
  */

  // FontAwesome JS icons
  @js.native
  @JSImport("@fortawesome/fontawesome-free/js/all.js", JSImport.Namespace)
  object FontAwesome extends js.Any

  FontAwesome

  // Phaser lib
  @js.native
  @JSImport("phaser", JSImport.Namespace)
  object PhaserGlobal extends js.Any //global import phaser

  PhaserGlobal

  // Jquery Resizable
  @js.native
  @JSImport("jquery-resizable-dom/dist/jquery-resizable.min.js", JSImport.Namespace)
  object JQueryResizable extends js.Any

  JQueryResizable

  // Phaser lib
  @js.native
  @JSImport("split.js", JSImport.Namespace)
  object Split extends Module {
    override def default: js.Dynamic = js.native
  }

  Split
}
