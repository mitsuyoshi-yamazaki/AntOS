
abstract class SomeSuperClass {
  hoge(): void { }
}
type SomeSuperClassAlias = SomeSuperClass

class InheritClass extends SomeSuperClass { }
class InheritAlias1 extends SomeSuperClassAlias { } // 'SomeSuperClassAlias' only refers to a type, but is being used as a value here.
class InheritAlias2 implements SomeSuperClassAlias { } // Property 'hoge' is missing in type 'InheritAlias2' but required in type 'SomeSuperClass'
