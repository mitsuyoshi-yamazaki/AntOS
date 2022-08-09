/**
 # Driver
 ## 概要
 Driverはsystem callのうち無効化してもkernelの動作に支障のないもの
 （依存processには支障が出る

 ## Processからの利用方法
 Driverはシングルトンインスタンスの形でインターフェースが提供される

 ## Discussion
 - Driverが無効化されていた場合に利用しようとした場合どうなるか
   - 現象としてはprocessがキルされるでよい
   - Processの依存driver一覧の提示はどのようになされればよいか？
   - 無効化される可能性のあるdriverとは定常的にCPU負荷のかかるものに限られるため、そのようなものが出てきたら考える
 */

import { SystemCall } from "./system_call"

export type Driver = SystemCall
