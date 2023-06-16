/**
 # https://stackoverflow.com/a/2656027
 */

interface P2PNetwork<N extends P2PNetwork<N, C>, C extends P2PClient<N, C>> {
  addClient(client: C): void
}

interface P2PClient<N extends P2PNetwork<N, C>, C extends P2PClient<N, C>> {
  setNetwork(network: N): void
}

class TorrentNetwork implements P2PNetwork<TorrentNetwork, TorrentClient> {
  addClient(client: TorrentClient): void { }
}

class TorrentClient implements P2PClient<TorrentNetwork, TorrentClient> {
  setNetwork(network: TorrentNetwork): void { }
}

type SelfPointableType<This extends SelfPointableType<This>> = {}

type ConcreteType = SelfPointableType<ConcreteType> // Type alias 'ConcreteType' circularly references itself.

abstract class SomeAbstractClass<This extends SomeAbstractClass<This>> implements SelfPointableType<This> {
  abstract returnItself(): This
}

class ConcreteClassA implements SelfPointableType<ConcreteClassA> {
}

class ConcreteClassB extends SomeAbstractClass<ConcreteClassB> {
  returnItself(): ConcreteClassB {
    return new ConcreteClassB()
  }
}

class ConcreteClassC extends SomeAbstractClass<ConcreteClassB> { // やっぱこれができる
  returnItself(): ConcreteClassC {
    return new ConcreteClassC()
  }
}
