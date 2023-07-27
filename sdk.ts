import {w3cwebsocket, IMessageEvent, ICloseEvent} from 'websocket';
import {Buffer} from "buffer";
import {MagicType, BasicPkt, BasicPktCodeType, Protocol} from "./protocol";
import {BasicController} from "./router";

export enum Ack {
    Success = "Success",            // 成功
    Timeout = "Timeout",            // 超时
    LoginFailed = "LoginFailed",    // 登录失败
    Logined = "Logined",            // 已登录
}

// 建立连接并且登录的操作
export let doLogin = async (url: string): Promise<{ status: string, conn: w3cwebsocket }> => {
    const LoginTimeout = 5 // 5 秒
    return new Promise((resolve, reject) => {
        // 创建 WebSocket 客户端对象 并 开始建立连接
        let conn = new w3cwebsocket(url)
        // 设置二进制类型
        conn.binaryType = "arraybuffer"

        // 设置一个登录超时器
        let tr = setTimeout(() => {
            resolve({status: Ack.Timeout, conn: conn});
        }, LoginTimeout * 1000);

        // 注册连接成功事件
        conn.onopen = () => {
            console.info("websocket open - readyState:", conn.readyState)

            if (conn.readyState === w3cwebsocket.OPEN) {
                // 关闭 登录超时器
                clearTimeout(tr)
                // 返回登录成功的状态 与 连接对象
                resolve({status: Ack.Success, conn: conn});
            }
        }        // 注册连接错误事件: 连接失败
        conn.onerror = (error: Error) => {
            clearTimeout(tr)
            // 返回登录失败的状态 与 连接对象
            resolve({status: Ack.LoginFailed, conn: conn});
        }
    })
}

// 连接的所有状态
export enum State {
    INIT,           // 初始化
    CONNECTING,     // 连接中
    CONNECTED,      // 已连接
    RECONNECTING,   // 正在重新连接
    CLOSING,        // 正在关闭
    CLOSED,         // 已关闭
}


export class IMClient {
    // WebSocket 连接地址
    public wsurl: string
    // 连接状态
    public state = State.INIT
    // WebSocket 连接对象
    private conn: w3cwebsocket | null
    // 心跳循环间隔 (单位：秒)
    private heartbeatInterval = 10
    // 最近读取到消息的时间戳
    private lastRead: number

    // 构造函数: 初始化属性值
    constructor(url: string, user: string) {
        this.wsurl = `${url}?username=${user}`
        this.conn = null
        this.lastRead = Date.now()
    }

    // 操作: 登录
    public async login(): Promise<{ status: string }> {
        // 如果状态为已连接 那么返回 Ack.Logined 状态
        if (this.state == State.CONNECTED) {
            return {status: Ack.Logined}
        }        // 状态更新为正在连接中...
        this.state = State.CONNECTING

        // 开始尝试建立连接
        let {status, conn} = await doLogin(this.wsurl)
        console.info("login - ", status)

        // 建立失败时 直接返回
        if (status !== Ack.Success) {
            return {status}
        }
        // +++++++++++++
        // 注册事件处理器
        this.registerEvent(conn)

        // 建立成功后 更新状态与保存连接对象
        this.conn = conn
        this.state = State.CONNECTED


        // +++++++++
        // 开启心跳循环
        this.heartbeatLoop()

        // ++++++++++++++++
        // 开启读超时检测循环
        this.readDeadlineLoop()

        return {status}
    }

    // 心跳循环 -> 定时发送心跳包
    private heartbeatLoop() {
        console.debug("heartbeatLoop start")

        let loop = () => {
            if (this.state != State.CONNECTED) {
                console.debug("heartbeatLoop exited")
                return
            }

            console.log(`>>> send ping ; state is ${this.state},`)
            let ping = (new BasicPkt()).setCode(BasicPktCodeType.Ping).encode()

            this.send(ping)

            setTimeout(loop, this.heartbeatInterval * 1000)
        }
        setTimeout(loop, this.heartbeatInterval * 1000)
    }

    // 发送消息
    private send(data: Buffer | ArrayBuffer): boolean {
        try {
            if (this.conn == null) {
                return false
            }
            this.conn.send(data)
        } catch (error) {
            return false
        }
        return true
    }

    // 读超时检测循环 -> 与心跳循环配合，成功一定会在指定范围内得到回应。
    private readDeadlineLoop() {
        console.debug("deadlineLoop start")

        let loop = () => {
            if (this.state != State.CONNECTED) {
                console.debug("deadlineLoop exited")
                return
            }

            if ((Date.now() - this.lastRead) > 3 * this.heartbeatInterval * 1000) {
                // 触发读超时 => 断开连接
                console.debug("deadlineLoop exited")
                if (this.conn != null) {
                    this.conn.close()
                }
                return
            }
            setTimeout(loop, 1000)
        }
        setTimeout(loop, 1000)
    }

    // 注册事件处理器
    private registerEvent(conn: w3cwebsocket): void {
        conn.onmessage = (evt: IMessageEvent) => {
            try {
                // 更新最近读取到消息的时间
                this.refreshLastRead()

                // 消息解包
                let protocol = new Protocol(new DataView(<ArrayBuffer>evt.data))
                let magic = protocol.decodeUint32Field()

                if (magic == MagicType.MAGIC_BASIC_PACKET) {
                    new BasicController().handler(protocol.getBuffer(protocol.offset))
                }

            } catch (error) {
                console.error(evt.data, error)
            }
        }
        conn.onclose = (event: ICloseEvent) => {
            this.onClose('断开连接')
        }
    }

    // 表示连接中止
    private onClose(reason: string) {
        console.info("connection closed due to " + reason)
        this.state = State.CLOSED
        // 通知上层应用，这里忽略
        // this.closeCallback()
    }

    // 刷新最近一次读取的时间
    private refreshLastRead() {
        this.lastRead = Date.now()
    }
}