package it.unibo.scafi.js.facade.phaser.namespaces.gameobjects

import it.unibo.scafi.js.facade.phaser.This
import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

@js.native
@JSGlobal("Phaser.Components")
object ComponentsNamespace extends js.Object {
  @js.native
  trait Transform extends js.Object with This {
    override type This <: Transform
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
    def setX(value : JSNumber) : This = js.native
    def setY(value : JSNumber) : This = js.native
    def setW(value : JSNumber) : This = js.native
    def setZ(value : JSNumber) : This = js.native
    def setRotation(angle : JSNumber) : This = js.native
    def setRandomPosition(x : JSNumber = js.native,
                          y : JSNumber = js.native,
                          width : JSNumber = js.native,
                          height : JSNumber = js.native) : This = js.native
    def setPosition(x : JSNumber = js.native,
                    y : JSNumber = js.native,
                    w : JSNumber = js.native,
                    z : JSNumber = js.native
                   ) : This = js.native
    def setAngle(degree : Int) : This = js.native
    def setScale(x : JSNumber, y : JSNumber = js.native): This = js.native
    def getParentRotation() : JSNumber = js.native
    def getLocalTransformMatrix(tempMatrix : TransformMatrix) : TransformMatrix
    def getWorldTransformMatrix(tempMatrix : TransformMatrix, parentMatrix : TransformMatrix) : TransformMatrix
  }

  @js.native
  trait Visible extends js.Object with This {
    override type This <: Visible
    var visible : Boolean = js.native
    def setVisible(value : Boolean) : This = js.native
  }

  @js.native
  trait Mask extends js.Object with This {
    override type This <: Mask
    /* todo */
  }

  @js.native
  class TransformMatrix extends js.Object with This {
    override type This <: TransformMatrix
    /* todo */
  }

  @js.native
  trait Depth extends js.Object with This {
    override type This <: Depth
    var depth : JSNumber = js.native
    def setDepth(value : JSNumber) : This = js.native
  }

  @js.native
  trait ComputedSize extends js.Object with This {
    override type This <: ComputedSize
    /* members */
    var displayHeight : JSNumber = js.native
    var displayWidth : JSNumber = js.native
    var height : JSNumber = js.native
    var width : JSNumber = js.native
    /* methods */
    def setDisplaySize(width : JSNumber, height : JSNumber) : This = js.native
    def setSize(width : JSNumber, height : JSNumber) : This = js.native
  }

  @js.native
  trait BlendMode extends js.Object with This {
    override type This <: BlendMode
    /* todo */
  }

  @js.native
  trait AlphaSingle extends js.Object with This {
    override type This <: AlphaSingle
    /* members */
    var alpha : JSNumber = js.native
    /* methods */
    def clearAlpha() : Unit = js.native
    def setAlpha(value : JSNumber) : Unit = js.native
  }

  @js.native
  trait Origin extends js.Object with This {
    override type This <: Origin
    /* members */
    var displayOriginX  : JSNumber = js.native
    var displayOriginY  : JSNumber = js.native
    var originX  : JSNumber = js.native
    var originY  : JSNumber = js.native
    /* methods */
    def setDisplayOrigin(x : JSNumber, y : JSNumber = js.native) : This = js.native
    def setOrigin(x : JSNumber, y : JSNumber = js.native) : This = js.native //todo think to do all return as is
    def setOriginFromFrame() : This = js.native
    def updateDisplayOrigin() : This = js.native
  }

  @js.native
  trait Pipeline extends js.Object with This {
    override type This <: Pipeline
    /* todo */
  }

  @js.native
  trait ScrollFactor extends js.Object with This {
    override type This <: ScrollFactor
    /* members */
    var scrollFactorX : JSNumber = js.native
    var scrollFactorY : JSNumber = js.native
    /* methods */
    def setScrollFactor(x : JSNumber, y : JSNumber = js.native) : This = js.native
  }

  @js.native
  trait Alpha extends js.Object with This {
    override type This <: Alpha
    /* members */
    var alpha : JSNumber = js.native
    var alphaBottomLeft : JSNumber = js.native
    var alphaBottomRight : JSNumber = js.native
    var alphaTopRight : JSNumber = js.native
    var alphaTopLeft : JSNumber = js.native
    /* methods */
    def clearAlpha() : This = js.native
    def setAlpha(topLeft : JSNumber = js.native,
                topRight : JSNumber = js.native,
                bottomLeft : JSNumber = js.native,
                bottomRight : JSNumber = js.native
                    ) : This = js.native
  }

  @js.native
  trait Texture extends js.Object with This {
    override type This <: Texture
    /*todo*/
  }

  @js.native
  trait Tint extends js.Object with This {
    override type This <: Tint
    /*todo*/
  }

  @js.native
  trait Crop extends js.Object with This {
    override type This <: Crop
    /*todo*/
  }

  @js.native
  trait Flip extends js.Object with This {
    override type This <: Flip
    /*todo*/
  }
}
