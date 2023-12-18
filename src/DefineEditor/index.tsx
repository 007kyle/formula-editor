import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import * as CodeMirror from 'codemirror'
import { useSetState } from 'ahooks'
import './defineScript'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/idea.css'
import 'codemirror/theme/material.css'
import './index.less'

interface EditorProps {
  defaultValue?: string
  readOnly?: boolean
  theme?: 'night' | 'day'
  lineNumber?: boolean
  height?: number
  fieldList?: ListItem[]
  methodList?: ListItem[]
  normalList?: ListItem[]
  id?: string
  onChange?: (value: string, error: string | null) => void
}

interface EditorState {
  blurFlag: boolean
  posLeft: number
  posTop: number
  tipShow: boolean
  tipShowType: CodeType
  dropList: ListItem[]
}

interface ListItem {
  name: string
  value: string
  realValue?: string
}

type CodeType = '@' | '#' | '' | null

interface EditorRef {
  // 暴露给父组件的实例方法
  focusEnd: () => void;
}

const DefineEditor: React.ForwardRefRenderFunction<EditorRef, EditorProps> = (
  {
    defaultValue = '',
    readOnly = false,
    theme = 'night',
    lineNumber,
    height = 300,
    fieldList = [],
    methodList = [],
    normalList = [],
    id,
    onChange
  },
  ref
) => {
  const [state, setState] =
    useSetState<EditorState>({
      blurFlag: false,
      posLeft: 0,
      posTop: 0,
      tipShow: false,
      tipShowType: null,
      dropList: []
    })
  const { posLeft, posTop, tipShow, tipShowType, dropList } = state
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<any>(null)
  const stateRef = useRef<EditorState>(state)
  stateRef.current = state
  // 导出函数
  useImperativeHandle(ref, () => ({
    focusEnd
  }))
  const setLocalStorage = () => {
    // 字段存本地，供分词高亮使用
    localStorage.codemirrorFieldList = getLoacalList(fieldList, '@')
    localStorage.codemirrorMethodList = getLoacalList(methodList, '#')
    localStorage.codemirrorNormalList = getLoacalList(normalList, '')
  }

  const getLoacalList = (list: any, type: any) => {
    const copyList = Object.assign([], list)
    // 排序，把长的放前面
    copyList.sort((a: any, b: any) => {
      if (a.name.length > b.name.length) {
        return -1
      }
      if (a.name.length < b.name.length) {
        return 1
      }
      return 0
    })
    const codemirrorList = []
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < copyList.length; i++) {
      codemirrorList.push(`${type}${copyList[i].name}`)
    }
    const obj: any = {}
    if (type === '@') obj.fieldList = copyList
    if (type === '#') obj.methodList = copyList
    if (type === '') obj.normalList = copyList
    setState({ ...obj })
    return JSON.stringify(codemirrorList)
  }

  useEffect(() => {
    setLocalStorage()

    let turnTheme
    if (theme === 'night') turnTheme = 'material'
    if (theme === 'day') turnTheme = 'idea'
    const current = textareaRef?.current as HTMLTextAreaElement
    editorRef.current = CodeMirror.fromTextArea(current, {
      mode: 'defineScript',
      theme: turnTheme,
      lineWrapping: true,
      lineNumbers: lineNumber,
      readOnly: readOnly ? 'nocursor' : false
    })
    editorRef.current.setValue(defaultValue)
    editorRef.current.setSize('auto', height)
    editorRef.current.on('cursorActivity', (cm: any) => {
      cursorActivity(cm)
    })
    editorRef.current.on('changes', (cm: any) => {
      if (onChange) {
        const errorkeyword = document.body.querySelector(
          `#${id} .cm-nomal-keyword`
        ) as HTMLElement | null
        console.log('errorkeyword:', errorkeyword)
        onChange(cm.getValue(), errorkeyword ? `格式错误 ${errorkeyword?.innerText}` : null)
      }
    })
    editorRef.current.on('focus', (cm: any) => {
      cursorActivity(cm)
      setState({ blurFlag: true })
    })
    editorRef.current.addKeyMap({
      Up: (cm: any) => {
        if (stateRef.current.tipShow) {
          enterFuc('up')
        } else {
          cm.execCommand('goLineUp')
        }
      },
      Down: (cm: any) => {
        console.log('tipShow:::', tipShow)
        if (stateRef.current.tipShow) {
          enterFuc('down')
        } else {
          cm.execCommand('goLineDown')
        }
      },
      Enter: (cm: any) => {
        if (stateRef.current.tipShow) {
          enterFuc('enter')
        } else {
          cm.execCommand('newlineAndIndent')
        }
      }
    })
    document.body.addEventListener('click', listenner)
    return () => {
      document.body.removeEventListener('click', listenner)
    }
  }, [])

  useEffect(() => {
    const cursor = editorRef.current.getCursor() // 保存当前光标位置
    if (editorRef.current && cursor) {
      editorRef.current.setValue(defaultValue)
      editorRef.current.setCursor(cursor) // 恢复光标位置
      editorRef.current.setSize('auto', height)
    }
  }, [defaultValue, height])

  const listenner = (e: any) => {
    const targetClassName = e.target.className
    if (typeof targetClassName !== 'string') return
    const list = ['codemirror-tip-day', 'codemirror-tip-night']
    const returnFalse = list.find((item) => targetClassName.includes(item))
    if (returnFalse) return false
    const targetPath = e.path || e.composedPath?.()
    let flag = false
    targetPath.forEach((item: any) => {
      if (item.className) {
        if (typeof item.className !== 'string') return
        if (
          item.className.includes('CodeMirror-line') ||
          item.className.includes('CodeMirror-linenumber')
        ) {
          flag = true
        }
      }
    })
    if (flag) {
      setState({ blurFlag: true })
    } else {
      setState({
        blurFlag: false,
        tipShow: false
      })
    }
    if (targetClassName === 'CodeMirror-scroll') {
      setState({ blurFlag: true })
    }
  }

  const cursorActivity = (cm: any) => {
    if (readOnly) return
    const getCursor = cm.getCursor()
    const pos = cm.cursorCoords(getCursor)
    const getLineInfo = cm.getLine(getCursor.line)
    const cursorBeforeOneChar = getLineInfo.substring(0, getCursor.ch)
    const lastIndex = cursorBeforeOneChar.lastIndexOf('@', getCursor.ch)
    const lastIndex2 = cursorBeforeOneChar.lastIndexOf('#', getCursor.ch)
    if (fieldList.length > 0 && lastIndex !== -1 && lastIndex > lastIndex2) {
      // 监测@
      const content = cursorBeforeOneChar.substring(lastIndex + 1, getCursor.ch)
      const findObj = fieldList.find((item: any) => item.name.includes(content))
      if (findObj) {
        setState({
          posLeft: pos.left,
          posTop: pos.top + 20,
          tipShow: true,
          tipShowType: '@'
        })
        search(content, '@')
      } else {
        setState({
          tipShow: false,
          tipShowType: null
        })
      }
    }
    if (methodList.length > 0 && lastIndex2 !== -1 && lastIndex2 > lastIndex) {
      // 监测#
      const content = cursorBeforeOneChar.substring(lastIndex2 + 1, getCursor.ch)
      const findObj = methodList.find((item: any) => item.name.includes(content))
      if (findObj) {
        setState({
          posLeft: pos.left,
          posTop: pos.top + 20,
          tipShow: true,
          tipShowType: '#'
        })
        search(content, '#')
      } else {
        setState({
          tipShow: false,
          tipShowType: null
        })
      }
    }
    if (!cursorBeforeOneChar.includes('@') && !cursorBeforeOneChar.includes('#')) {
      setState({
        tipShow: false,
        tipShowType: null
      })
    }
  }

  const search = (val: string, type: CodeType) => {
    const list: ListItem[] = []
    const searchList = type === '@' ? fieldList : methodList
    searchList.forEach((item: ListItem) => {
      if (item.name.includes(val)) {
        list.push(item)
      }
    })
    setState({
      dropList: list
    })
    defaultFirst()
  }

  const handleClick = (item: ListItem, type: CodeType) => {
    const getCursor = editorRef.current.getCursor()
    const getLineInfo = editorRef.current.getLine(getCursor.line)
    const cursorBeforeOneChar = getLineInfo.substring(0, getCursor.ch)
    const lastIndex = cursorBeforeOneChar.lastIndexOf(type, getCursor.ch)
    editorRef.current.setSelection(
      { line: getCursor.line, ch: lastIndex + 1 },
      { line: getCursor.line, ch: getCursor.ch }
    )
    const content = type === '@' ? item.name : item.value
    editorRef.current.replaceSelection(content)
    editorRef.current.setCursor(getCursor.line, lastIndex + 1 + content.length)
    editorRef.current.focus()
    setState({
      tipShow: false,
      tipShowType: null
    })
  }
  // 聚焦到结尾
  const focusEnd = () => {
    setTimeout(() => {
      console.log('focus end')
      handleClick({ name: '', value: '' }, '')
    }, 300)
  }

  const enterFuc = (type: string) => {
    const findLi = 'cm-field-li'
    const active = 'cm-active'
    const nodeList = document.querySelectorAll(`.${findLi}`)
    const length = nodeList.length
    let index = 0
    for (let i = 0; i < length; i++) {
      if (nodeList[i].className.includes(active)) {
        index = i
      }
    }
    if (type === 'up') {
      nodeList[index].className = findLi
      if (index === 0) {
        nodeList[index].className = `${active} ${findLi}`
      } else {
        nodeList[index - 1].className = `${active} ${findLi}`
      }
    } else if (type === 'down') {
      nodeList[index].className = findLi
      if (index === length - 1) {
        nodeList[index].className = `${active} ${findLi}`
      } else {
        nodeList[index + 1].className = `${active} ${findLi}`
      }
    } else if (type === 'enter') {
      const node = document.querySelector(`.${active}`) as any
      handleClick(
        {
          name: node.innerText,
          value: node.attributes['data-value'].value
        },
        stateRef.current.tipShowType
      )
      setTimeout(() => {
        setState({
          tipShow: false,
          tipShowType: null
        })
      }, 100)
    }
    const activeNode = document.querySelector(`.${active}`) as any
    activeNode?.scrollIntoViewIfNeeded && activeNode?.scrollIntoViewIfNeeded?.()
  }

  const defaultFirst = () => {
    const findLi = 'cm-field-li'
    const active = 'cm-active'
    const nodeList = document.querySelectorAll(`.${findLi}`)
    if (nodeList.length > 0) {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < nodeList.length; i++) {
        nodeList[i].className = findLi
      }
      nodeList[0].className = `${active} ${findLi}`
    }
  }

  return (
    <div className='m-codemirror'>
      <textarea ref={textareaRef} />
      {/* @弹框 */}
      <div
        className={`codemirror-tip-${theme}`}
        style={{
          left: `${posLeft}px`,
          top: `${posTop}px`,
          display: tipShow ? 'inline-block' : 'none'
        }}
      >
        <ul className='cm-field-ul'>
          {dropList &&
            dropList.length > 0 &&
            dropList.map((item: ListItem, index: number) => {
              return (
                <li
                  key={index}
                  className={index === 0 ? 'cm-active cm-field-li' : 'cm-field-li'}
                  data-value={item.value}
                  onClick={() => {
                    handleClick(item, tipShowType)
                  }}
                >
                  {item.name}
                </li>
              )
            })}
        </ul>
      </div>
    </div>
  )
}
export default forwardRef(DefineEditor)
