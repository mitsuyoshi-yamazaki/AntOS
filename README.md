# AntOS
Mitsuyoshi's Screeps script.
https://screeps.com/a/#!/profile/Mitsuyoshi

## Deploy
```shell
# Official server
$ export DEST=<environment>
$ yarn deploy

# Community/Private server
# set password: see https://github.com/ScreepsMods/screepsmod-auth
$ export DEST=<environment>
$ yarn deploy
```

## Troubleshooting
### Cannot redefine propertyが出る場合
- tick中にcatchされない例外が発生すると次tickでrootレベルの処理が再実行される(a
- rootレベルの処理が再実行されるとObject.definePropertyが複数回呼ばれることにより例外が発生する(b
表出している問題はbだがaが根本原因なのでaを解決する
