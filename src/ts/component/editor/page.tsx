import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { RouteComponentProps } from 'react-router';
import { Block, Icon } from 'ts/component';
import { I, Key, Util, dispatcher, focus, keyboard } from 'ts/lib';
import { observer, inject } from 'mobx-react';
import { throttle } from 'lodash';

interface Props extends RouteComponentProps<any> {
	commonStore?: any;
	blockStore?: any;
	dataset?: any;
	rootId: string;
	container: string;
	addOffsetY: number;
};

const com = require('proto/commands.js');
const Constant = require('json/constant.json');
const $ = require('jquery');
const raf = require('raf');
const THROTTLE = 20;

@inject('commonStore')
@inject('blockStore')
@observer
class EditorPage extends React.Component<Props, {}> {

	_isMounted: boolean = false;
	timeoutHover: number = 0;
	hovered: string =  '';
	hoverDir: number = 0;
	scrollTop: number = 0;

	constructor (props: any) {
		super(props);
		
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onKeyUp = this.onKeyUp.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onAdd = this.onAdd.bind(this);
	};

	render () {
		const { blockStore, rootId } = this.props;
		const { blocks } = blockStore;
		const tree = blockStore.prepareTree(rootId, blocks[rootId] || []);
		
		return (
			<div className="editor">
				<div className="blocks">
					<Icon id="button-add" className="buttonAdd" onClick={this.onAdd} />
				
					{tree.map((item: I.Block, i: number) => { 
						return (
							<Block 
								key={item.id} 
								index={i}
								{...item} 
								{...this.props}
								onKeyDown={throttle((e: any, text: string) => { this.onKeyDown(e, text); }, THROTTLE)} 
								onKeyUp={throttle((e: any, text: string) => { this.onKeyUp(e, text); }, THROTTLE)} 
							/>
						)
					})}
				</div>
			</div>
		);
	};
	
	componentDidMount () {
		this._isMounted = true;
		
		const { blockStore, rootId } = this.props;
		const win = $(window);
		
		keyboard.disableBack(true);
		this.unbind();
		win.on('mousemove.editor', throttle((e: any) => { this.onMouseMove(e); }, THROTTLE));
		win.on('scroll.editor', throttle((e: any) => { this.onScroll(e); }, THROTTLE));
		win.on('keydown.editor', (e: any) => { this.onKeyDownCommon(e); });
		
		dispatcher.call('blockOpen', { blockId: rootId }, (errorCode: any, message: any) => {});
	};
	
	componentDidUpdate () {
		const { blockStore, rootId } = this.props;
		const { blocks } = blockStore;
		const { focused, range } = focus;
		
		const tree = blockStore.prepareTree(rootId, blocks[rootId] || []);
		const focusedBlock = (blocks[rootId] || []).find((it: I.Block) => { return it.id == focused; });
		const title = tree.find((it: I.Block) => { return (it.type == I.BlockType.Text) && (it.content.style == I.TextStyle.Title); });
		
		if (!focusedBlock && title) {
			let text = String(title.content.text || '');
			if (text == Constant.untitled) {
				text = '';
			};
			let length = text.length;
			
			focus.set(title.id, { from: length, to: length });
		};
		
		focus.apply();
		
		window.setTimeout(() => { window.scrollTo(0, this.scrollTop); }, 1);
	};
	
	componentWillUnmount () {
		this._isMounted = false;
		
		const { blockStore, rootId } = this.props;
		
		keyboard.disableBack(false);
		this.unbind();
		
		blockStore.blocksClear(rootId);
		dispatcher.call('blockClose', { blockId: rootId }, (errorCode: any, message: any) => {});
	};
	
	unbind () {
		$(window).unbind('keydown.editor mousemove.editor scroll.editor');
	};
	
	onMouseMove (e: any) {
		if (!this._isMounted) {
			return;
		};
		
		const { container, addOffsetY } = this.props;
		
		const win = $(window);
		const node = $(ReactDOM.findDOMNode(this));
		const blocks = node.find('.block');
		const containerEl = $(container);
		const rectContainer = (containerEl.get(0) as Element).getBoundingClientRect() as DOMRect;
		const st = win.scrollTop();
		const add = node.find('#button-add');
		const { pageX, pageY } = e;
		const offset = 100;
		
		let hovered: any = null;
		let rect = { x: 0, y: 0, width: 0, height: 0 };
		
		// Find hovered block by mouse coords
		blocks.each((i: number, item: any) => {
			item = $(item);
			
			let rect = $(item).get(0).getBoundingClientRect() as DOMRect;
			let { x, y, width, height } = rect;
			y += st;

			if ((pageX >= x) && (pageX <= x + width) && (pageY >= y) && (pageY <= y + height)) {
				hovered = item;
			};
		});
		
		if (hovered) {
			rect = (hovered.get(0) as Element).getBoundingClientRect() as DOMRect;
			this.hovered = hovered.data('id');
		};
		
		let { x, y, width, height } = rect;
		y += st;
		
		window.clearTimeout(this.timeoutHover);
		
		if (hovered && (pageX >= x) && (pageX <= x + Constant.size.blockMenu) && (pageY >= offset) && (pageY <= st + rectContainer.height - offset)) {
			this.hoverDir = pageY < (y + height / 2) ? -1 : 1;
			
			add.css({ opacity: 1, left: rect.x - rectContainer.x + 2, top: pageY - 10 + containerEl.scrollTop() + Number(addOffsetY) });
			blocks.addClass('showMenu').removeClass('isAdding top bottom');
			
			if (hovered && (pageX <= x + 20)) {
				hovered.addClass('isAdding ' + (this.hoverDir < 0 ? 'top' : 'bottom'));
			};
		} else {
			this.timeoutHover = window.setTimeout(() => {
				add.css({ opacity: 0 });
				blocks.removeClass('showMenu isAdding top bottom');
			}, 10);
		};
	};
	
	onKeyDownCommon (e: any) {
		let k = e.which;
		
		if (keyboard.focus) {
			return;
		};
		
		if (e.ctrlKey || e.metaKey) {
			if (k == Key.a) {
				e.preventDefault();
				this.selectAll();
			};
		};
		
		if (k == Key.backspace) {
			e.preventDefault();
			this.blockRemove();
		};
	};
	
	onKeyDown (e: any, text?: string) {
		const { blockStore, commonStore, dataset, rootId } = this.props;
		const { focused, range } = focus;
		const { blocks } = blockStore;
		const { selection } = dataset;
		
		const block = blocks[rootId].find((item: I.Block) => { return item.id == focused; });
		if (!block) {
			return;
		};
		
		const index = blocks[rootId].findIndex((item: I.Block) => { return item.id == focused; });
		const { content } = block;

		let l = String(text || '').length;
		let k = e.which;
		
		if (e.ctrlKey || e.metaKey) {
			if ((k == Key.a) && (range.from == 0) && (range.to == l)) {
				e.preventDefault();
				this.selectAll();
			};
		};
		
		if (
			((range.from == 0) && (k == Key.up)) ||
			((range.to == l) && (k == Key.down))
		) {
			e.preventDefault();
			
			const dir = (k == Key.up) ? -1 : 1;
			const next = blockStore.getNextBlock(rootId, focused, dir, (item: any) => {
				return item.type == I.BlockType.Text;
			});
			
			if (e.shiftKey) {
				if (selection.get().length < 1) {
					window.getSelection().empty();
					commonStore.menuClose('blockContext');
					selection.set([ focused ]);
					commonStore.menuClose('blockAction');					
				};
			} else if (next) {
				const l = String(next.content.text || '').length;
				const newRange = (dir > 0 ? { from: 0, to: 0 } : { from: l, to: l });
					
				focus.set(next.id, newRange);
				focus.apply();
			};
		};
		
		if ((k == Key.backspace) && (range.from == 0 && range.to == 0)) {
			let ids = selection.get();
			if (l && !ids.length) {
				this.blockMerge(block);
			} else {
				this.blockRemove(block);
			};
		};
		
		if (k == Key.enter) {
			e.preventDefault();
			
			if ((range.from == l) && (range.to == l)) {
				let param: any = {
					type: I.BlockType.Text,
					content: {
						style: I.TextStyle.Paragraph,
					},
				};
				if ([ I.TextStyle.Checkbox, I.TextStyle.Bulleted, I.TextStyle.Numbered ].indexOf(block.content.style) >= 0) {
					param.content.style = block.content.style;
				};
				
				this.blockCreate(block, 1, param);
			} else {
				this.blockSplit(block, range.from);
			};
		};
	};
	
	onKeyUp (e: any, text?: string) {
	};
	
	selectAll () {
		const { blockStore, commonStore, dataset, rootId } = this.props;
		const { blocks } = blockStore;
		const { selection } = dataset;
		
		selection.set(blocks[rootId].map((item: I.Block) => { return item.id; }));
		window.getSelection().empty();
		focus.clear();
		commonStore.menuClose('blockContext');
	};
	
	onAdd (e: any) {
		if (!this.hovered) {
			return;
		};
		
		const { blockStore, commonStore, rootId } = this.props;
		const { blocks } = blockStore;
		const block = blocks[rootId].find((item: I.Block) => { return item.id == this.hovered; });
		const node = $(ReactDOM.findDOMNode(this));
		
		if (!block) {
			return;
		};
		
		node.find('#block-' + $.escapeSelector(block.id)).addClass('isAddingMenu ' + (this.hoverDir < 0 ? 'mtop' : 'mbottom'));
		
		let param: any = {};
		
		commonStore.menuOpen('blockAdd', { 
			element: 'button-add',
			type: I.MenuType.Vertical,
			offsetX: 24,
			offsetY: -20,
			vertical: I.MenuDirection.Bottom,
			horizontal: I.MenuDirection.Left,
			onClose: () => {
				node.find('.block.isAddingMenu').removeClass('isAddingMenu mtop mbottom');
			},
			data: {
				onSelect: (e: any, item: any) => {
					switch (item.parentId) {
						case 'text':
						case 'list':
							param.type = I.BlockType.Text;
							param.content = {
								style: item.id,
							};
							break;
							
						case 'tool':
							break;
							
						case 'media':
							param.type = item.id;
							
							if (item.id == 'code') {
								param.type = I.BlockType.Text;
								param.content = {
									style: I.TextStyle.Code,
								};
							};
							break;
							
						case 'other':
							param.type = item.id;
							break;
					};
					
					this.blockCreate(block, this.hoverDir, param);
				}
			}
		});
	};
	
	onScroll (e: any) {
		this.scrollTop = $(window).scrollTop();
	};
	
	blockCreate (focused: I.Block, dir: number, param: any) {
		const { blockStore, rootId } = this.props;
		
		let request = {
			block: blockStore.prepareBlockToProto(param),
			contextId: rootId,
			parentId: focused.parentId || rootId,
			targetId: focused.id,
			position: dir > 0 ? I.BlockPosition.After : I.BlockPosition.Before,
		};
		
		dispatcher.call('blockCreate', request, (errorCode: any, message: any) => {
			focus.set(message.blockId, { from: 0, to: 0 });
			focus.apply();
		});
	};
	
	blockMerge (focused: I.Block) {
		const { blockStore, rootId } = this.props;
		const next = blockStore.getNextBlock(rootId, focused.id, -1, (item: any) => {
			return item.type == I.BlockType.Text;
		});
		
		if (!next) {
			return;
		};
		
		let l = next.content.text.length;
		let request = {
			contextId: rootId,
			firstBlockId: next.id,
			secondBlockId: focused.id,
		};
		dispatcher.call('blockMerge', request, (errorCode: any, message: any) => {
			if (next) {
				focus.set(next.id, { from: l, to: l });
				focus.apply();				
			};
		});
	};
	
	blockSplit (focused: I.Block, start: number) {
		const { rootId } = this.props;
		
		let request = {
			contextId: rootId,
			blockId: focused.id,
			cursorPosition: start,
		};
		dispatcher.call('blockSplit', request, (errorCode: any, message: any) => {
			focus.set(message.blockId, { from: 0, to: 0 });
			focus.apply();
		});
	};
	
	blockRemove (focused?: I.Block) {
		const { blockStore, rootId, dataset } = this.props;
		const { selection } = dataset;

		let next: any = null;
		let ids = selection.get();
		let targets = [];
		
		if (ids.length) {
			next = blockStore.getNextBlock(rootId, ids[0], -1, (item: any) => {
				return item.type == I.BlockType.Text;
			});
		
			for (let id of ids) {
				targets.push({ blockId: id });
			};
		} else 
		if (focused) {
			next = blockStore.getNextBlock(rootId, focused.id, -1, (item: any) => {
				return item.type == I.BlockType.Text;
			});
			
			targets.push({ blockId: focused.id });
		};
		
		let request: any = {
			contextId: rootId,
			targets: targets,
		};
		dispatcher.call('blockUnlink', request, (errorCode: any, message: any) => {
			if (next) {
				focus.set(next.id, { from: 0, to: 0 });
				focus.apply();				
			};
		});
	};
	
};

export default EditorPage;