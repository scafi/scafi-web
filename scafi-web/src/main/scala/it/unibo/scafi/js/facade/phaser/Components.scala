package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

@js.native
@JSImport("phaser", JSImport.Namespace)
object Components extends js.Object {
  @js.native
  trait Transform extends js.Object {
    /* members */
    var angle : Int = js.native
    var rotation : JSNumber = js.native
    var scale : JSNumber = js.native
    var scaleX : JSNumber = js.native
    var scaleY : JSNumber = js.native
    var w : JSNumber = js.native
    var x : JSNumber = js.native
    var y : JSNumber = js.native
    var z : JSNumber = js.native
    /* methods */
    def setX(value : JSNumber) : Unit = js.native
    def setY(value : JSNumber) : Unit = js.native
    def setW(value : JSNumber) : Unit = js.native
    def setZ(value : JSNumber) : Unit = js.native
    def setRotation(angle : JSNumber) : Unit = js.native
    def setRandomPosition(x : JSNumber = js.native,
                          y : JSNumber = js.native,
                          width : JSNumber = js.native,
                          height : JSNumber = js.native) : Unit = js.native
    def setPosition(x : JSNumber = js.native,
                    y : JSNumber = js.native,
                    w : JSNumber = js.native,
                    z : JSNumber = js.native
                   )
    def setAngle(degree : Int) : Unit = js.native
    def getParentRotation() : JSNumber = js.native
    def getLocalTransformMatrix(tempMatrix : TransformMatrix) : TransformMatrix
    def getWorldTransformMatrix(tempMatrix : TransformMatrix, parentMatrix : TransformMatrix) : TransformMatrix
  }

  @js.native
  trait Visible extends js.Object {
    var visible : Boolean = js.native
    def setVisible(value : Boolean) : Unit = js.native
  }

  @js.native
  trait Mask extends js.Object { /* todo */}

  @js.native
  class TransformMatrix extends js.Object { /* todo */ }

  @js.native
  trait Depth extends js.Object {
    var depth : JSNumber = js.native
    def setDepth(value : JSNumber) : Unit = js.native
  }

  @js.native
  trait ComputedSize extends js.Object {
    /* members */
    var displayHeight : JSNumber = js.native
    var displayWidth : JSNumber = js.native
    var height : JSNumber = js.native
    var width : JSNumber = js.native
    /* methods */
    def setDisplaySize(width : JSNumber, height : JSNumber) : Unit = js.native
    def setSize(width : JSNumber, height : JSNumber) : Unit = js.native
  }

  @js.native
  trait BlendMode extends js.Object { /* todo */ }

  @js.native
  trait AlphaSingle extends js.Object {
    /* members */
    var alpha : JSNumber = js.native
    /* methods */
    def clearAlpha() : Unit = js.native
    def setAlpha(value : JSNumber) : Unit = js.native
  }

  @js.native
  trait Origin extends js.Object {
    /* members */
    var displayOriginX  : JSNumber = js.native
    var displayOriginY  : JSNumber = js.native
    var originX  : JSNumber = js.native
    var originY  : JSNumber = js.native
    /* methods */
    def setDisplayOrigin(x : JSNumber, y : JSNumber = js.native) : Unit = js.native
    def setOrigin[Me](x : JSNumber, y : JSNumber = js.native) : Me = js.native
    def setOriginFromFrame() : Unit = js.native
    def updateDisplayOrigin() : Unit = js.native
  }

  @js.native
  trait Pipeline extends js.Object { /* todo */ }

  @js.native
  trait ScrollFactor extends js.Object {
    /* members */
    var scrollFactorX : JSNumber = js.native
    var scrollFactorY : JSNumber = js.native
    /* methods */
    def setScrollFactor(x : JSNumber, y : JSNumber = js.native) : Unit = js.native
  }
}
