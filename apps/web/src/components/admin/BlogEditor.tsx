'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link2, ImagePlus, Highlighter, Table as TableIcon,
  AlignRight, AlignCenter, AlignLeft, Undo2, Redo2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface BlogEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}

export function BlogEditor({ value, onChange, placeholder = 'متن مقاله را بنویسید…', className }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4, 5, 6] },
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[280px] px-3 py-2 focus:outline-none text-right',
        dir: 'rtl',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== editor.getText()) {
      // Only reset when external value meaningfully changes (e.g. load edit)
      if (!editor.isFocused) {
        editor.commands.setContent(value || '', false);
      }
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('آدرس لینک', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const setImage = () => {
    const url = window.prompt('آدرس تصویر');
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: '' }).run();
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-gray-200', className)}>
      <div className="flex flex-wrap gap-0.5 border-b border-gray-100 bg-gray-50 p-1.5" dir="rtl">
        <ToolbarButton title="پررنگ" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="ایتالیک" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="زیرخط" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="خط‌خورده" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="هایلایت" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-gray-200" />
        <ToolbarButton title="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="لیست" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="لیست شماره‌دار" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="نقل‌قول" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="جداکننده" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-gray-200" />
        <ToolbarButton title="لینک" onClick={setLink} active={editor.isActive('link')}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="تصویر" onClick={setImage}>
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="جدول"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-gray-200" />
        <ToolbarButton title="راست‌چین" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="وسط" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="چپ‌چین" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 w-px self-stretch bg-gray-200" />
        <ToolbarButton title="واگرد" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="بازانجام" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
