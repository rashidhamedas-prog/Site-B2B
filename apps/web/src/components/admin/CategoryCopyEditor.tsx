'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Link2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isInternalCategoryHref, plainToEditorHtml } from '@/lib/catalog/category-copy';

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-gray-600 hover:bg-gray-100',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}

export function CategoryCopyEditor({
  label,
  value,
  onChange,
  hint,
  hintTone,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  hintTone?: 'ok' | 'warn';
}) {
  const emit = useRef(false);
  const loaded = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { target: null, rel: null, class: null },
        isAllowedUri: (url) => isInternalCategoryHref(url),
      }),
    ],
    content: plainToEditorHtml(value),
    editorProps: {
      attributes: {
        class: 'min-h-[6rem] px-3 py-2 text-sm leading-7 focus:outline-none',
        dir: 'rtl',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!emit.current && !ed.isFocused) return;
      emit.current = false;
      const html = ed.getHTML();
      loaded.current = html;
      onChangeRef.current(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (loaded.current === value) return;
    if (editor.isFocused) return;
    editor.commands.setContent(plainToEditorHtml(value), false);
    loaded.current = value;
  }, [editor, value]);

  const edit = (run: () => void) => {
    emit.current = true;
    run();
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(
      'آدرس داخلی را وارد کنید. باید با / شروع شود.',
      prev || '/category/',
    );
    if (url === null) return;
    if (url.trim() === '') {
      edit(() => editor.chain().focus().extendMarkRange('link').unsetLink().run());
      return;
    }
    const href = url.trim();
    if (!isInternalCategoryHref(href)) {
      window.alert('فقط مسیر داخلی سایت مجاز است. مثال: /category/coat-pants-set');
      return;
    }
    edit(() => editor.chain().focus().extendMarkRange('link').setLink({ href }).run());
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex gap-0.5 border-b border-gray-100 bg-gray-50 p-1" dir="rtl">
          <ToolbarButton
            title="پررنگ"
            active={editor?.isActive('bold')}
            onClick={() => editor && edit(() => editor.chain().focus().toggleBold().run())}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="ایتالیک"
            active={editor?.isActive('italic')}
            onClick={() => editor && edit(() => editor.chain().focus().toggleItalic().run())}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="لینک داخلی" active={editor?.isActive('link')} onClick={setLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-[6rem] bg-gray-50" />
        )}
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        متن را انتخاب کنید و لینک داخلی بگذارید. مثال: /category/coat-pants-set
      </p>
      {hint ? (
        <p
          className={cn(
            'mt-1 text-[11px]',
            hintTone === 'ok' ? 'text-emerald-600' : hintTone === 'warn' ? 'text-amber-600' : 'text-gray-400',
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
