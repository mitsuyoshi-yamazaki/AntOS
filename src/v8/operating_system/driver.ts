/**
 # Driver
 ## 概要
 Driverはsystem callのうち無効化してもkernelの動作に支障のないもの
 （依存processには支障が出る

 ## 要件
 資源の仮想化を行い、抽象化された操作を可能にする

 ## Processからの利用方法
 Driverはシングルトンインスタンスの形でインターフェースが提供される

 ## Discussion
 - Driverが無効化されていた場合に利用しようとした場合どうなるか
   - 現象としてはprocessがキルされるでよい
   - Processの依存driver一覧の提示はどのようになされればよいか？
   - 無効化される可能性のあるdriverとは定常的にCPU負荷のかかるものに限られるため、そのようなものが出てきたら考える
 - 無効化可能なDriver, 制御可能なDriverはどこから制御すべきか？
   - 状態はDriverが独自に永続化すべきか？
   - Driverはプリミティブな機能をラップする機能であるべきで、状態をもち実行可能な処理はProcessに置く
 */

import { SystemCall } from "./system_call"

export type Driver = SystemCall
