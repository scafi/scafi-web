package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser._
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace
import it.unibo.scafi.js.utils.{JSNumber, Nullable}
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSName}
import scala.scalajs.js.{ThisFunction, |}

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.html]] */
@js.native
@JSGlobal("Phaser.GameObjects")
object GameObjectsNamespace extends js.Object {
  /* NAMESPACES */
  val Components : ComponentsNamespace.type = js.native
  import Components._
  import Phaser._
  /* CLASSES */
  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.GameObject.html]]
    */
  @js.native
  trait GameObject extends Events.EventEmitter with This {
    override type This <: GameObject
    /* members */
    var active : Boolean = js.native
    def data : Data.DataManager = js.native
    var ignoreDestroy : Boolean = js.native
    def input : types.input.InteractiveObject = js.native
    var name : String = js.native
    def parentContainer : Container = js.native
    var state : Int | String = js.native
    def tabIndex : Int = js.native
    @JSName("type")
    def tpe :  String = js.native
    /* methods */
    def destroy(fromScene : Boolean = js.native) : Unit
    def setActive(value : Boolean) : Unit = js.native
    def setName(name : String) : Unit = js.native
    def setState(state : Int | String) : Unit = js.native
    def setDataEnabled() : Unit = js.native
    def setData(key : String | js.Object, data : js.Any): This = js.native
    def getData(key : String) : js.Any = js.native
    def setInteractive(shape : types.input.InputConfiguration | js.Any = js.native,
                       callback : js.Function4[js.Any, JSNumber, JSNumber, GameObject, Unit] = js.native,
                       dropZone : Boolean = js.native): Unit = js.native
    def disableInteractive() : Unit = js.native
    def removeInteractive() : Unit = js.native
    def update() : Unit = js.native
    def willRender(camera : Cameras.Scene2D.Camera) : Boolean = js.native
    def getIndexList() : js.Array[Int] = js.native
  }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Container.html]]
   */
  @js.native
  trait Container extends GameObject with AlphaSingle with BlendMode
    with ComputedSize with Depth with Mask with Transform with Visible with ThisGeneric[Container] {
    /* members */
    def list[Child <: GameObject] : js.Array[Child] = js.native
    def exclusive : Boolean = js.native
    def maxSize : Int = js.native
    def position : Int = js.native
    var scrollFactorX : JSNumber = js.native
    var scrollFactorY : JSNumber = js.native
    /* method */
    def setExclusive(value : Boolean) : Unit = js.native
    def getBounds(output : Geom.Rectangle = js.native) : Geom.Rectangle = js.native
    def getBoundsTransformMatrix() : Unit = js.native
    def pointToContainer(source : Geom.Point | Math.Vector2, output : Geom.Point | Math.Vector2 = js.native) : Geom.Point | Math.Vector2
    def add(child : GameObject | js.Array[GameObject]): Unit = js.native
    def addAt(child : GameObject | js.Array[GameObject], index : Int = js.native): Unit = js.native
    def getAt(index : Int) : GameObject = js.native
    // todo def sort
    def getByName(name : String) : GameObject = js.native
    def getRandom(startIndex : Int = js.native, length : js.UndefOr[Int] = js.native) : Nullable[GameObject] = js.native
    def getAll(property : String = js.native,
               value : js.Any = js.native,
               startIndex : Int = js.native,
               endIndex : Int = js.native) : js.Array[GameObject] = js.native
    def getFirst(property : String,
               value : js.Any,
               startIndex : Int = js.native,
               endIndex : Int = js.native) : Nullable[GameObject] = js.native
    def swap(child1 : GameObject, child2 : GameObject) : Unit = js.native
    def count(property : String = js.native,
              value : js.Any = js.native,
              startIndex : Int = js.native,
              endIndex : Int = js.native) : Int = js.native
    def moveTo(child : GameObject, index : Int) : Unit = js.native
    def remove(child : GameObject, destroyChild : Boolean = js.native) : Unit = js.native
    def removeAt(child : GameObject, destroyChild : Boolean = js.native) : Unit = js.native
    def removeBetween(startIndex : Int = js.native, endIndex : Int = js.native, destroyChild : Boolean = js.native) : Unit = js.native
    def removeAll(destroyChild : Boolean = js.native) : Unit = js.native
    def bringToTop(child : GameObject) : Unit = js.native
    def sendToBack(child : GameObject) : Unit = js.native
    def moveUp(child : GameObject) : Unit = js.native
    def moveDown(child : GameObject) : Unit = js.native
    def reverse() : Unit = js.native
    def shuffle() : Unit = js.native
    def replace(child : GameObject, newChild : GameObject, destroyChild : Boolean = js.native) : Unit = js.native
    def exists(child : GameObject) : Boolean = js.native
    def setAll(property : String = js.native,
               value : js.Any = js.native,
               startIndex : Int = js.native,
               endIndex : Int = js.native) : Unit = js.native
    def each(callback : ThisFunction, context : js.Object = js.native, args : js.Any = js.native) : Unit = js.native
    def iterate(callback : ThisFunction, context : js.Object = js.native, args : js.Any) : Unit = js.native
    def setScrollFactor(x : Int, y : Int = js.native, updateChildren : Boolean = js.native) : Unit = js.native
    /*todo model next, previous...*/
  }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.GameObjectFactory.html]]
   */
  @js.native
  trait GameObjectFactory extends js.Object {
    def displayList : DisplayList = js.native

    def scene : Phaser.Scene = js.native

    def circle(x : JSNumber = js.native, y : JSNumber, radius : JSNumber, fillColor : Int = js.native, fillAlpha : JSNumber = js.native) : Arc = js.native

    def line(x : JSNumber = js.native,
             y : JSNumber = js.native,
             x1 : JSNumber = js.native,
             y1 : JSNumber = js.native,
             x2 : JSNumber = js.native,
             y2 : JSNumber = js.native, strokeColor : Int = js.native, strokeAlpha : JSNumber = js.native) : Line = js.native
    def rectangle(x : JSNumber = js.native,
                  y : JSNumber, width : JSNumber,
                  height : JSNumber,
                  fillColor : Int = js.native,
                  fillAlpha : JSNumber = js.native) : Rectangle = js.native
    def dom(x : JSNumber,
            y : JSNumber,
            element : HTMLElement | String,
            style : String = js.native,
            innerText : String = js.native) : DOMElement = js.native
    def bitmapText(x : JSNumber, y : JSNumber, font : String, text : String, size  : JSNumber = js.native) : BitmapText = js.native
    def text(x : JSNumber, y : JSNumber, text : String, style : types.gameobjects.text.TextStyle = js.native) : Text = js.native
    def container(x : JSNumber = js.native, y : JSNumber = js.native, children : js.Array[GameObject] = js.native) : Container
  }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.GameObjectCreator.html]]
   */
  @js.native
  class GameObjectCreator(val scene : Phaser.Scene) extends js.Object { /* todo */}

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.GameObjectCreator.html]]
   */
  @js.native
  trait DisplayList extends js.Object {
    def getChildren() : js.Array[GameObject] = js.native
  }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.LightsManager.html]]
   */
  @js.native
  trait LightsManager extends js.Object { /* todo */ }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Shape.html]]
   */
  @js.native
  trait Shape extends GameObject with Transform with BlendMode with ComputedSize with GetBounds with AlphaSingle
    with Depth with Origin with Mask with Pipeline with ScrollFactor with Visible with This {
    override type This <: Shape
    /* members */
    var strokeAlpha : JSNumber = js.native
    var strokeColor : JSNumber = js.native
    /* methods */
    def setStrokeStyle(lineWidth : JSNumber = js.native, color : Int = js.native, alpha : JSNumber = js.native) : This
  }

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Line.html]]
   */
  @js.native
  trait Line extends Shape

  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Rectangle.html]]
   */
  @js.native
  trait Rectangle extends Shape with ThisGeneric[Rectangle]
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Arc.html]] */
  @js.native
  trait Arc extends Shape with ThisGeneric[Arc] {
    /* members */
    var startAngle : Int = js.native
    var endAngle : Int = js.native
    var radius : JSNumber = js.native
    var anticlockwise : Boolean = js.native
    var iterations : JSNumber = js.native
    /* methods */
    def setEndAngle(value : Int) : Arc = js.native
    def setStartAngle(value : Int) : Arc = js.native
    def setRadius(value : JSNumber) : Arc = js.native
    def setIterations(valeu : Int) : Arc = js.native
  }

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.BitmapText.html]] */
  @js.native
  trait BitmapText extends GameObject with Alpha with BlendMode with Depth
    with Mask with Origin with Pipeline with ScrollFactor with Tint with Transform
    with Visible with ThisGeneric[BitmapText] {
    /* static */
    val ALIGN_CENTER : Int = js.native
    val ALIGN_LEFT : Int = js.native
    val ALIGN_RIGHT : Int = js.native
    /* members */
    var font : String = js.native
    var text : String = js.native
    var fontData : types.gameobjects.bitmaptext.BitmapFontData = js.native
    var letterSpacing : JSNumber = js.native
    var align : Int = js.native
    var bounds : types.gameobjects.bitmaptext.BitmapTextSize = js.native
    var dirty : Boolean = js.native
    var wordWrapCharCode : JSNumber = js.native
    /* methods */
    def setLeftAlign() : BitmapText = js.native
    def setCenterAlign() : BitmapText = js.native
    def setRightAlign() : BitmapText = js.native
    def setFontSize(size : JSNumber) : BitmapText = js.native
    def setLetterSpacing(spacing : JSNumber) : BitmapText = js.native
    def setText(text : String) : BitmapText = js.native
    def getTextBounds(round : Boolean) : types.gameobjects.bitmaptext.BitmapTextSize = js.native
    def setFont(key : String, size : JSNumber, align : Int = js.native) : BitmapText = js.native
    def setMaxWidth(value : JSNumber, wordWrapCharCode : JSNumber) : BitmapText = js.native
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Text.html]]
   */
  @js.native
  trait Text extends GameObject with Alpha with BlendMode with Depth with ComputedSize
    with Mask with Origin with Pipeline with ScrollFactor with Tint with Transform
    with Visible with Crop with Flip with ThisGeneric[Text] {
    /* todo */
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Sprite.html]]
   */
  @js.native
  trait Sprite extends js.Object with ThisGeneric[Sprite] { /* todo */ }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.DOMElement.html]]
   */
  @js.native
  trait DOMElement extends GameObject with AlphaSingle with BlendMode with Depth with Origin with ScrollFactor
    with Transform with Visible with ThisGeneric[DOMElement] {
    def createElement()
  }
}
