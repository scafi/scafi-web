package it.unibo.scafi.compiler.cache

trait CodeCache {
  def put(id : String, code : String) : CodeCache
  def permanent(id : String, code : String) : CodeCache
  def get(id : String) : Option[String]
  def hit(id : String) : Boolean
}

object CodeCache {
  def limit(elements : Int) : CodeCache = CodeCacheLimited(elements, Seq.empty, Seq.empty)

  case class CodeCacheLimited(elements : Int, codeSeq : Seq[(String, String)], permanent : Seq[(String, String)]) extends CodeCache {
    private val allElements = codeSeq ++ permanent
    override def put(id: String, code: String): CodeCache = if (codeSeq.size >= elements) {
      CodeCacheLimited(elements, codeSeq.tail :+ (id -> code), permanent)
    } else {
      CodeCacheLimited(elements, codeSeq :+ (id -> code), permanent)
    }

    override def get(id: String): Option[String] = allElements.find(_._1 == id).map(_._2)

    override def hit(id: String): Boolean = allElements.exists(_._1 == id)

    override def permanent(id: String, code: String): CodeCache = CodeCacheLimited(elements, codeSeq, (id -> code) +: permanent)
  }
}