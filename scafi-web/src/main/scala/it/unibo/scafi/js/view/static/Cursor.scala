package it.unibo.scafi.js.view.static

/**
  * An enumeration used to defined all type of html cursor
  * @see See [[https://www.w3schools.com/cssref/pr_class_cursor.asp]]
  * @param html the cursor style value
  */
sealed abstract class Cursor(val html : String)

object Cursor {
  case object Alias extends Cursor("alias")
  case object AllScroll extends Cursor("all-scroll")
  case object Auto extends Cursor("auto")
  case object Cell extends Cursor("cell")
  case object ContextMenu extends Cursor("context-menu")
  case object ColResize extends Cursor("col-resize")
  case object Copy extends Cursor("copy")
  case object Crosshair extends Cursor("crosshair")
  case object Default extends Cursor("default")
  case object EResize extends Cursor("e-resize")
  case object EwResize extends Cursor("ew-resize")
  case object Grab extends Cursor("grab")
  case object Grabbing extends Cursor("grabbing")
  case object Help extends Cursor("help")
  case object Move extends Cursor("move")
  case object NResize extends Cursor("n-resize")
  case object NeResize extends Cursor("ne-resize")
  case object NeswResize extends Cursor("nesw-resize")
  case object NsResize extends Cursor("ns-resize")
  case object NoDrop extends Cursor("no-drop")
  case object None extends Cursor("none")
  case object NotAllowed extends Cursor("not-allowed")
  case object Pointer extends Cursor("pointer")
  case object Progress extends Cursor("progress")
  case object RowResize extends Cursor("row-resize")
  case object SResize extends Cursor("s-resize")
  case object SeResize extends Cursor("se-resize")
  case object SwResize extends Cursor("sw-resize")
  case object WResize extends Cursor("w-resize")
  case object Text extends Cursor("text")
  case object Url extends Cursor("url")
  case object Wait extends Cursor("wait")
  case object ZoomIn extends Cursor("zoom-in")
  case object ZoomOut extends Cursor("zoom-out")

  object Implicits {
    implicit def cursorToString(cursor: Cursor) : String = cursor.html
  }
}
