import { Component } from 'react'
import Taro from '@tarojs/taro'
import './app.css'

class App extends Component {
  componentDidMount() {
    // 可选：尝试静默登录，获取 openid 后本地保存，不影响匿名考试
    Taro.login({
      success: (res) => {
        if (res.code) {
          Taro.setStorageSync('wx_login_code', res.code)
        }
      },
      fail: () => {
        // 静默失败不影响使用
      },
    })
  }

  componentDidShow() {}

  componentDidHide() {}

  componentDidCatchError() {}

  render() {
    return this.props.children
  }
}

export default App
