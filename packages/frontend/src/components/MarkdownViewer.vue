<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import '@/styles/markdown.css';
import { renderMarkdown } from '@/api/markdown.ts';

const props = defineProps<{
    content?: string;
    loading?: boolean;
    preRendered?: boolean;
}>();

const contentRef = ref<HTMLElement | null>(null);
const renderedContent = ref('');

const CARET_RIGHT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
<!--!Font Awesome Pro v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2025 Fonticons, Inc.-->
<path d="M441.3 299.8C451.5 312.4 450.8 330.9 439.1 342.6L311.1 470.6C301.9 479.8 288.2 482.5 276.2 477.5C264.2 472.5 256.5 460.9 256.5 448L256.5 192C256.5 179.1 264.3 167.4 276.3 162.4C288.3 157.4 302 160.2 311.2 169.3L439.2 297.3L441.4 299.7z"/></svg>
`;

const renderMath = () => {
    if (contentRef.value) {
        renderMathInElement(contentRef.value, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }
};

const toggleMarkdownBlock = (event: Event) => {
    const title = event.currentTarget as HTMLElement;
    const body = title.nextElementSibling as HTMLElement | null;
    const btn = title.querySelector('.toggle-btn');
    if (!body || !btn) return;

    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    btn.classList.toggle('expanded', isHidden);
};

const initMarkdownBlocks = () => {
    if (!contentRef.value) return;

    contentRef.value.querySelectorAll('.md-block .md-block-title').forEach(title => {
        const btn = title.querySelector('.toggle-btn');
        if (!btn) return;

        btn.className = 'toggle-btn';

        btn.innerHTML = CARET_RIGHT_SVG;

        const body = title.nextElementSibling as HTMLElement;
        if (body && body.style.display !== 'none') {
            btn.classList.add('expanded');
        }

        title.removeEventListener('click', toggleMarkdownBlock);
        title.addEventListener('click', toggleMarkdownBlock);
    });
};

const processContent = async () => {
    if (!props.content) {
        renderedContent.value = '';
        return;
    }

    if (props.preRendered === false) {
        const rendered = await renderMarkdown(props.content);
        renderedContent.value = rendered.data.html;
    } else {
        renderedContent.value = props.content;
    }

    await nextTick();
    renderMath();
    initMarkdownBlocks();
};

watch(() => [props.content, props.preRendered], processContent);

onMounted(processContent);
</script>

<template>
    <div class="md-container">
        <div v-if="loading" class="empty-tip">加载中...</div>
        <div v-else-if="!renderedContent" class="empty-tip">暂无内容</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else ref="contentRef" class="md-body" v-html="renderedContent"></div>
    </div>
</template>

<style scoped></style>
