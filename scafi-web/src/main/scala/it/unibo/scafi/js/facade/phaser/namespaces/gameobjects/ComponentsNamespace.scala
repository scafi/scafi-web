package it.unibo.scafi.js.facade.phaser.namespaces.gameobjects

import it.unibo.scafi.js.JSNumber

import scala.scalajs.js

@js.native
trait ComponentsNamespace extends js.Object {
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
    def setX[Me](value : JSNumber) : Unit = js.native
    def setY[Me](value : JSNumber) : Unit = js.native
    def setW[Me](value : JSNumber) : Unit = js.native
    def setZ[Me](value : JSNumber) : Unit = js.native
    def setRotation[Me](angle : JSNumber) : Unit = js.native
    def setRandomPosition[Me](x : JSNumber = js.native,
                          y : JSNumber = js.native,
                          width : JSNumber = js.native,
                          height : JSNumber = js.native) : Unit = js.native
    def setPosition[Me](x : JSNumber = js.native,
                    y : JSNumber = js.native,
                    w : JSNumber = js.native,
                    z : JSNumber = js.native
                   )
    def setAngle[Me](degree : Int) : Unit = js.native
    def setScale[Me](x : JSNumber, y : JSNumber = js.native): Me = js.native
    def getParentRotation() : JSNumber = js.native
    def getLocalTransformMatrix(tempMatrix : TransformMatrix) : TransformMatrix
    def getWorldTransformMatrix(tempMatrix : TransformMatrix, parentMatrix : TransformMatrix) : TransformMatrix
  }

  @js.native
  trait Visible extends js.Object {
    var visible : Boolean = js.native
    def setVisible[Me](value : Boolean) : Me = js.native
  }

  @js.native
  trait Mask extends js.Object { /* todo */}

  @js.native
  class TransformMatrix extends js.Object { /* todo */ }

  @js.native
  trait Depth extends js.Object {
    var depth : JSNumber = js.native
    def setDepth[Me](value : JSNumber) : Me = js.native
  }

  @js.native
  trait ComputedSize extends js.Object {
    /* members */
    var displayHeight : JSNumber = js.native
    var displayWidth : JSNumber = js.native
    var height : JSNumber = js.native
    var width : JSNumber = js.native
    /* methods */
    def setDisplaySize[Me](width : JSNumber, height : JSNumber) : Me = js.native
    def setSize[Me](width : JSNumber, height : JSNumber) : Me = js.native
  }

  @js.native
  trait BlendMode extends js.Object { /* todo */ }

  @js.native
  trait AlphaSingle extends js.Object {
    /* members */
    var alpha : JSNumber = js.native
    /* methods */
    def clearAlpha[Me]() : Unit = js.native
    def setAlpha[Me](value : JSNumber) : Unit = js.native
  }

  @js.native
  trait Origin extends js.Object {
    /* members */
    var displayOriginX  : JSNumber = js.native
    var displayOriginY  : JSNumber = js.native
    var originX  : JSNumber = js.native
    var originY  : JSNumber = js.native
    /* methods */
    def setDisplayOrigin[Me](x : JSNumber, y : JSNumber = js.native) : Me = js.native
    def setOrigin[Me](x : JSNumber, y : JSNumber = js.native) : Me = js.native //todo think to do all return as is
    def setOriginFromFrame[Me]() : Me = js.native
    def updateDisplayOrigin[Me]() : Me = js.native
  }

  @js.native
  trait Pipeline extends js.Object { /* todo */ }

  @js.native
  trait ScrollFactor extends js.Object {
    /* members */
    var scrollFactorX : JSNumber = js.native
    var scrollFactorY : JSNumber = js.native
    /* methods */
    def setScrollFactor[Me](x : JSNumber, y : JSNumber = js.native) : Me = js.native
  }

  @js.native
  trait Alpha extends js.Object {
    /* members */
    var alpha : JSNumber = js.native
    var alphaBottomLeft : JSNumber = js.native
    var alphaBottomRight : JSNumber = js.native
    var alphaTopRight : JSNumber = js.native
    var alphaTopLeft : JSNumber = js.native
    /* methods */
    def clearAlpha[Me]() : Me = js.native
    def setAlpha[Me](
                    topLeft : JSNumber = js.native,
                    topRight : JSNumber = js.native,
                    bottomLeft : JSNumber = js.native,
                    bottomRight : JSNumber = js.native
                    ) : Me = js.native
  }

  @js.native
  trait Texture extends js.Object { /*todo*/ }

  @js.native
  trait Tint extends js.Object { /*todo*/ }

  @js.native
  trait Crop extends js.Object { /*todo*/ }

  @js.native
  trait Flip extends js.Object { /*todo*/ }
}
