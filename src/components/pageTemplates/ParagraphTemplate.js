import React, { useState, useRef } from 'react'
import { css } from '@emotion/core'
import { BlogContext } from '../../context/mainContext'
import { Editor, getEventTransfer } from 'slate-react'
import { Value } from 'slate'
import isUrl from 'is-url'
import { isKeyHotkey } from 'is-hotkey'
import { Button, Icon, Toolbar } from './components'

import EditOptions from './EditOptions'

const DEFAULT_NODE = 'paragraph'

const isBoldHotkey = isKeyHotkey('mod+b')
const isItalicHotkey = isKeyHotkey('mod+i')
const isCodeHotkey = isKeyHotkey('mod+`')

function wrapLink(editor, href) {
  editor.wrapInline({
    type: 'link',
    data: { href },
  })

  editor.moveToEnd()
}

function unwrapLink(editor) {
  editor.unwrapInline('link')
}

function Paragraph({ index, deleteComponent, context: { theme }}) {
  const [value, updateValue] = useState(Value.fromJSON(initialValue))
  const [editable, updateIsEditable] = useState(false)
  const editorRef = useRef(null);

  function hasMark(type) {
    return value.activeMarks.some(mark => mark.type === type)
  }
  function hasBlock(type) {
    return value.blocks.some(node => node.type === type)
  }
  function onChange({ value }){
    updateValue(value)
  }
  function hasLinks() {
    return value.inlines.some(inline => inline.type === 'link')
  }
  function renderInline(props, editor, next) {
    const { attributes, children, node } = props

    switch (node.type) {
      case 'link': {
        const { data } = node
        const href = data.get('href')
        return (
          <a {...attributes} href={href}>
            {children}
          </a>
        )
      }

      default: {
        return next()
      }
    }
  }
  function onPaste(event, editor, next) {
    if (editor.value.selection.isCollapsed) return next()

    const transfer = getEventTransfer(event)
    const { type, text } = transfer
    if (type !== 'text' && type !== 'html') return next()
    if (!isUrl(text)) return next()

    if (hasLinks()) {
      editor.command(unwrapLink)
    }

    editor.command(wrapLink, text)
  }
  function onClickLink(event) {
    event.preventDefault()
    const { value } = editorRef.current
    const links = hasLinks()

    if (links) {
      editorRef.current.command(unwrapLink)
    } else if (value.selection.isExpanded) {
      const href = window.prompt('Enter the URL of the link:')

      if (href == null) {
        return
      }

      editorRef.current.command(wrapLink, href)
    } else {
      const href = window.prompt('Enter the URL of the link:')

      if (href == null) {
        return
      }

      const text = window.prompt('Enter the text for the link:')

      if (text == null) {
        return
      }

      editorRef
        .current
        .insertText(text)
        .moveFocusBackward(text.length)
        .command(wrapLink, href)
    }
  }
  function renderMarkButton(type, icon) {
    const isActive = hasMark(type)
  
    return (
      <Button
        active={isActive}
        onMouseDown={event => onClickMark(event, type)}
      >
        <Icon>{icon}</Icon>
      </Button>
    )
  }
  function renderBlockButton(type, icon) {
    let isActive = hasBlock(type)

    if (['numbered-list', 'bulleted-list'].includes(type)) {
      const { document, blocks } = value

      if (blocks.size > 0) {
        const parent = document.getParent(blocks.first().key)
        isActive = hasBlock('list-item') && parent && parent.type === type
      }
    }
    return (
      <Button
        active={isActive}
        onMouseDown={event => onClickBlock(event, type)}
      >
        <Icon>{icon}</Icon>
      </Button>
    )
  }
  function renderBlock (props, editor, next) {
    const { attributes, children, node } = props

    switch (node.type) {
      case 'block-quote':
        return <blockquote {...attributes}>{children}</blockquote>
      case 'bulleted-list':
        return <ul {...attributes}>{children}</ul>
      case 'heading-one':
        return <h1 {...attributes}>{children}</h1>
      case 'heading-two':
        return <h2 {...attributes}>{children}</h2>
      case 'list-item':
        return <li {...attributes}>{children}</li>
      case 'numbered-list':
        return <ol {...attributes}>{children}</ol>
      default:
        return next()
    }
  }
  function onKeyDown(event, editor, next) {
    let mark

    if (isBoldHotkey(event)) {
      mark = 'bold'
    } else if (isItalicHotkey(event)) {
      mark = 'italic'
    } else if (isCodeHotkey(event)) {
      mark = 'code'
    } else {
      return next()
    }

    event.preventDefault()
    editor.toggleMark(mark)
  }
  function onClickMark(event, type) {
    event.preventDefault()
    editorRef.current.toggleMark(type)
  }
  function onClickBlock(event, type) {
    event.preventDefault()

    const { value: editorValue } = editorRef.current
    const { document } = editorValue

    // Handle everything but list buttons.
    if (type !== 'bulleted-list' && type !== 'numbered-list') {
      const isActive = hasBlock(type)
      const isList = hasBlock('list-item')

      if (isList) {
        editorRef
          .current
          .setBlocks(isActive ? DEFAULT_NODE : type)
          .unwrapBlock('bulleted-list')
          .unwrapBlock('numbered-list')
      } else {
        editorRef.current.setBlocks(isActive ? DEFAULT_NODE : type)
      }
    } else {
      // Handle the extra wrapping required for list buttons.
      const isList = hasBlock('list-item')
      const isType = editorValue.blocks.some(block => {
        return !!document.getClosest(block.key, parent => parent.type === type)
      })

      if (isList && isType) {
        editorRef
          .current
          .setBlocks(DEFAULT_NODE)
          .unwrapBlock('bulleted-list')
          .unwrapBlock('numbered-list')
      } else if (isList) {
        editorRef
          .current
          .unwrapBlock(
            type === 'bulleted-list' ? 'numbered-list' : 'bulleted-list'
          )
          .wrapBlock(type)
      } else {
        editorRef.current.setBlocks('list-item').wrapBlock(type)
      }
    }
  }
  function renderMark (props, editor, next) {
    const { children, mark, attributes } = props

    switch (mark.type) {
      case 'bold':
        return <strong {...attributes}>{children}</strong>
      case 'code':
        return <code {...attributes}>{children}</code>
      case 'italic':
        return <em {...attributes}>{children}</em>
      default:
        return next()
    }
  }
  
  return (
    <div css={paragraphTemplateStyle}>
      <div css={editorContainerStyle()}>
        <Toolbar>
          {renderMarkButton('bold', 'B')}
          {renderMarkButton('italic', 'I')}
          {renderMarkButton('code', 'code')}
          <Button active={hasLinks()} onMouseDown={onClickLink}>
            <Icon>link</Icon>
          </Button>
          {renderBlockButton('heading-one', 'H1')}
          {renderBlockButton('heading-two', 'H2')}
          {renderBlockButton('block-quote', '"')}
          {renderBlockButton('numbered-list', 'NL')}
          {renderBlockButton('bulleted-list', 'UL')}
        </Toolbar>
        <Editor
          spellCheck
          autoFocus
          placeholder="Enter some rich text..."
          ref={editorRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          renderBlock={renderBlock}
          renderMark={renderMark}
          onPaste={onPaste}
          renderInline={renderInline}
        />
      </div>
      <EditOptions
        editable={editable}
        updateIsEditable={() => updateIsEditable(!editable)}
        theme={theme}
        deleteComponent={() => deleteComponent(index)}
        hideEdit
      />
    </div>
  )
}

const ParagraphWithContext = props => (
  <BlogContext.Consumer>
    {
      context => <Paragraph {...props} context={context} />
    }
  </BlogContext.Consumer>
)

const editorContainerStyle = () => css`
  margin: 0px 10px;
`

const paragraphTemplateStyle = css`
  position: relative;
`

const paragraphStyle = ({ fontFamily, primaryFontColor }) => css`
  font-family: ${fontFamily}, serif;
  font-size: 18px;
  margin: 0px 0px 35px;
  line-height: 1.756;
  color: ${primaryFontColor};
  outline: none;
  border: none;
  padding: 5px 10px;
  border: 1px solid transparent;
`

const editingStyle = () => css`
  border: 1px solid #ddd;
`

export default ParagraphWithContext

const initialValue = {
  "object": "value",
  "document": {
    "object": "document",
    "nodes": [
      {
        "object": "block",
        "type": "paragraph",
        "nodes": [
          {
            "object": "text",
            "text": "This is editable "
          },
          {
            "object": "text",
            "text": "rich",
            "marks": [{ "type": "bold" }]
          },
          {
            "object": "text",
            "text": " text, "
          },
          {
            "object": "text",
            "text": "much",
            "marks": [{ "type": "italic" }]
          },
          {
            "object": "text",
            "text": " better than a "
          },
          {
            "object": "text",
            "text": "<textarea>",
            "marks": [{ "type": "code" }]
          },
          {
            "object": "text",
            "text": "!"
          }
        ]
      },
      {
        "object": "block",
        "type": "paragraph",
        "nodes": [
          {
            "object": "text",
            "text":
              "Since it's rich text, you can do things like turn a selection of text "
          },
          {
            "object": "text",
            "text": "bold",
            "marks": [{ "type": "bold" }]
          },
          {
            "object": "text",
            "text":
              ", or add a semantically rendered block quote in the middle of the page, like this:"
          }
        ]
      },
      {
        "object": "block",
        "type": "block-quote",
        "nodes": [
          {
            "object": "text",
            "text": "A wise quote."
          }
        ]
      },
      {
        "object": "block",
        "type": "paragraph",
        "nodes": [
          {
            "object": "text",
            "text": "Try it out for yourself!"
          }
        ]
      },
      {
        "object": "block",
        "type": "paragraph",
        "nodes": [
          {
            "object": "text",
            "text":
              "This example shows hyperlinks in action. It features two ways to add links. You can either add a link via the toolbar icon above, or if you want in on a little secret, copy a URL to your keyboard and paste it while a range of text is selected."
          }
        ]
      }
    ]
  }
}

const initialLinkValue = {
  "object": "value",
  "document": {
    "object": "document",
    "nodes": [
      {
        "object": "block",
        "type": "paragraph",
        "nodes": [
          {
            "object": "text",
            "text":
              "In addition to block nodes, you can create inline nodes, like "
          },
          {
            "object": "inline",
            "type": "link",
            "data": {
              "href": "https://en.wikipedia.org/wiki/Hypertext"
            },
            "nodes": [
              {
                "object": "text",
                "text": "hyperlinks"
              }
            ]
          },
          {
            "object": "text",
            "text": "!"
          }
        ]
      },
      
    ]
  }
}