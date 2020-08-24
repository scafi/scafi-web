package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.facade.phaser.Components._
import it.unibo.scafi.js.{JSNumber, Nullable}

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSImport, JSName}
import scala.scalajs.js.{ThisFunction, |}
@js.native
@JSImport("phaser", JSImport.Namespace)
object GameObjects extends js.Object {
  @js.native
  trait GameObject extends Events.EventEmitter {
    /* members */
    var active : Boolean = js.native
    var data : Data.DataManager = js.native
    var ignoreDestroy : Boolean = js.native
    var input : configuration.Input.InteractiveObject = js.native
    var name : String = js.native
    var parentContainer : Container = js.native
    var state : Int | String = js.native
    var tabIndex : Int = js.native
    @JSName("type")
    var tpe :  String = js.native
    /* methods */
    def destroy(fromScene : Boolean = js.native) : Unit
    def setActive(value : Boolean) : Unit = js.native
    def setName(name : String) : Unit = js.native
    def setState(state : Int | String) : Unit = js.native
    def setDataEnabled() : Unit = js.native
    def setData(key : String | js.Object, data : js.Any): Unit = js.native
    def getData(key : String) : js.Any = js.native
    def setInteractive(shape : configuration.Input.Config | js.Any = js.native,
                       callback : js.Function4[js.Any, JSNumber, JSNumber, GameObject, Unit] = js.native,
                       dropZone : Boolean = js.native): Unit = js.native
    def disableInteractive() : Unit = js.native
    def removeInteractive() : Unit = js.native
    def update() : Unit = js.native
    def willRender(camera : Scene2D.Camera) : Boolean = js.native
    def getIndexList() : js.Array[Int] = js.native
  }

  @js.native
  trait Container extends GameObject with AlphaSingle with BlendMode with ComputedSize with Depth with Mask with Transform with Visible {
    /* members */
    var list : js.Array[GameObject] = js.native
    var exclusive : Boolean = js.native
    var maxSize : Int = js.native
    var position : Int = js.native
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

  @js.native
  trait Shape extends GameObject with Transform with BlendMode with ComputedSize
    with Depth with Origin with Mask with Pipeline with ScrollFactor with Visible {

  }

  @js.native
  trait Line extends Shape

  @js.native
  trait Arc extends Shape

  @js.native
  trait GameObjectFactory extends js.Object {
    def displayList : DisplayList = js.native

    def scene : Phaser.Scene = js.native

    def circle(x : JSNumber = js.native, y : JSNumber, radius : JSNumber, fillColor : Int = js.native, fillAlpha : Int = js.native) : Arc = js.native

    def line(x : JSNumber = js.native,
             y : JSNumber = js.native,
             x1 : JSNumber = js.native,
             y1 : JSNumber = js.native,
             x2 : JSNumber = js.native,
             y2 : JSNumber = js.native, strokeColor : Int = js.native, strokeAlpha : Int = js.native) : Line = js.native
    def container(x : JSNumber = js.native, y : JSNumber = js.native, children : js.Array[GameObject] = js.native) : Container
  }
  @js.native
  trait DisplayList extends js.Object {
    def getChildren() : js.Array[GameObject] = js.native
  }
}
