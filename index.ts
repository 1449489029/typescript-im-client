import { IMClient } from "./sdk";

const main = async () => {
	// websocket 服务的地址 = ws://192.168.3.26:9502
	// 用户名 = ccc
    let cli = new IMClient("ws://192.168.3.26:9502", "ccc");  
    // 执行登录的操作
    let { status } = await cli.login()
    // 打印出登录的状态
    console.log("client login return -- ", status)  
}  
  
main()
