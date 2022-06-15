package it.unibo.scafi.js.code

import it.unibo.scafi.js.utils.GlobalStore
import org.scalajs.dom.ext.Ajax
import org.scalajs.dom
import scala.concurrent.{ExecutionContext, Future}
import upickle.default._

import scala.util.Success

trait ExampleProvider {
  def getExamples: Future[Seq[ExampleGroup]]
}

object ExampleProvider {
  private val storeKey = "examples"
  private val examplesPath = s"${dom.window.location.href}config/examples.json"
  /** Combine provider by requesting the example in order. the first provider that returns a sequence of example
    * provider successfully complete the future
    * @param providers
    *   the sequence of provider that tries to load examples
    */
  def race(providers: ExampleProvider*)(implicit context: ExecutionContext): Future[Seq[ExampleGroup]] =
    providers.map(_.getExamples).reduce((resultingFuture, current) => resultingFuture.recoverWith { case _ => current })

  def fromRemote()(implicit context: ExecutionContext): ExampleProvider = new ExampleProvider {
    override def getExamples: Future[Seq[ExampleGroup]] = Ajax
      .get(examplesPath)
      .map(_.responseText)
      .andThen { case Success(value) => GlobalStore.put(storeKey, value) }
      .map(result => read[Seq[ExampleGroup]](result))
  }

  def fromGlobal()(implicit context: ExecutionContext): ExampleProvider = new ExampleProvider {
    override def getExamples: Future[Seq[ExampleGroup]] =
      Future.fromTry(GlobalStore.get[String](storeKey).map(data => read[Seq[ExampleGroup]](data)))
  }
}
