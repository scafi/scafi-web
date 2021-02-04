package it.unibo.scafi.js.facade.phaser.namespaces.gameobjects

import it.unibo.scafi.js.facade.phaser.{Phaser, This}
import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/**
 * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.html]]
 */
@js.native
@JSGlobal("Phaser.Gameobject.Components")
object ComponentsNamespace extends js.Object {
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Transform.html]]
   */
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
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Visible.html]]
   */
  @js.native
  trait Visible extends js.Object with This {
    override type This <: Visible
    var visible : Boolean = js.native
    def setVisible(value : Boolean) : This = js.native
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Mask.html]]
   */
  @js.native
  trait Mask extends js.Object with This {
    override type This <: Mask
    /* todo */
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.TransformMatrix.html]]
   */
  @js.native
  class TransformMatrix extends js.Object with This {
    override type This <: TransformMatrix
    /* todo */
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Depth.html]]
   */
  @js.native
  trait Depth extends js.Object with This {
    override type This <: Depth
    var depth : JSNumber = js.native
    def setDepth(value : JSNumber) : This = js.native
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.ComputedSize.html]]
   */
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
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.BlendMode.html]]
   */
  @js.native
  trait BlendMode extends js.Object with This {
    override type This <: BlendMode
    /* todo */
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.AlphaSingle.html]]
   */
  @js.native
  trait AlphaSingle extends js.Object with This {
    override type This <: AlphaSingle
    /* members */
    var alpha : JSNumber = js.native
    /* methods */
    def clearAlpha() : Unit = js.native
    def setAlpha(value : JSNumber) : Unit = js.native
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Origin.html]]
   */
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
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Pipeline.html]]
   */
  @js.native
  trait Pipeline extends js.Object with This {
    override type This <: Pipeline
    /* todo */
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.ScrollFactor.html]]
   */
  @js.native
  trait ScrollFactor extends js.Object with This {
    override type This <: ScrollFactor
    /* members */
    var scrollFactorX : JSNumber = js.native
    var scrollFactorY : JSNumber = js.native
    /* methods */
    def setScrollFactor(x : JSNumber, y : JSNumber = js.native) : This = js.native
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Alpha.html]]
   */
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
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Texture.html]]
   */
  @js.native
  trait Texture extends js.Object with This {
    override type This <: Texture
    /*todo*/
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Texture.Tint.html]]
   */
  @js.native
  trait Tint extends js.Object with This {
    override type This <: Tint
    def setTint( topLeft : JSNumber, topRight : JSNumber, bottomLeft : JSNumber, bottomRight : JSNumber)
    /*todo*/
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Crop.html]]
   */
  @js.native
  trait Crop extends js.Object with This {
    override type This <: Crop
    /*todo*/
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Flip.html]]
   */
  @js.native
  trait Flip extends js.Object with This {
    override type This <: Flip
    /*todo*/
  }
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.GetBounds.html]]
   */
  @js.native
  trait GetBounds extends js.Object with This {
    override type This <: GetBounds
    def getBounds(output : Phaser.Geom.Rectangle = js.native) : Phaser.Geom.Rectangle = js.native
    /*todo*/
  }
}
