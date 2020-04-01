import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { commonStore } from 'ts/store';
import { Icon, Loader } from 'ts/component';
import { observer } from 'mobx-react';
import { I, C, Mark, Util, focus } from 'ts/lib';

interface Props {};
interface State {
	loading: boolean;
	type: I.BookmarkType;
	title: string;
	description: string;
	url: string;
	faviconUrl: string;
	imageUrl: string;
};

const $ = require('jquery');
const raf = require('raf');
const { ipcRenderer } = window.require('electron');

@observer
class LinkPreview extends React.Component<Props, {}> {
	
	state = {
		loading: false,
		type: I.BookmarkType.Unknown,
		title: '',
		description: '',
		url: '',
		faviconUrl: '',
		imageUrl: '',
	};
	
	constructor (props: any) {
		super(props);
		
		this.onCopy = this.onCopy.bind(this);
		this.onEdit = this.onEdit.bind(this);
		this.onUnlink = this.onUnlink.bind(this);
		this.onClick = this.onClick.bind(this);
	};
	
	render () {
		let { loading, title, description, url, faviconUrl, imageUrl } = this.state;
		const { linkPreview } = commonStore;
		
		let content = null;
		let style: any = {};
		if (imageUrl) {
			style.backgroundImage = 'url("' + imageUrl + '")';
		};
		
		if (loading) {
			content = <Loader />
		} else 
		if (url) {
			content = (
				<React.Fragment>
					<div className="head">
						<div id="button-copy" className="item" onClick={this.onCopy}>Copy link</div>
						<div id="button-edit" className="item" onClick={this.onEdit}>Edit link</div>
						<div id="button-unlink" className="item" onClick={this.onUnlink}>Unlink</div>
					</div>
					<div className="cp" onClick={this.onClick}>
						{imageUrl ? <div className="img" style={style} /> : ''}
						<div className="info">
							{title ? <div className="name">{title}</div> : ''}
							{description ? <div className="descr">{description}</div> : ''}
							<div className="link">
								{faviconUrl ? <Icon icon={faviconUrl} className="fav" /> : ''}
								{url}
							</div>
						</div>
					</div>
				</React.Fragment>
			);
		};
		
		return (
			<div id="linkPreview" className="linkPreview">
				<div className="polygon" onClick={this.onClick} />
				<div className="content">{content}</div>
			</div>
		);
	};
	
	componentDidUpdate () {
		const { loading, url, imageUrl } = this.state;
		const { linkPreview } = commonStore;
		const node = $(ReactDOM.findDOMNode(this));
		
		if (!loading && linkPreview.url && (linkPreview.url != url)) {
			this.setState({ loading: true });
			
			C.LinkPreview(linkPreview.url, (message: any) => {
				if (message.error.code) {
					return;
				};
				
				this.setState({
					type: Number(message.linkPreview.type) || 0,
					title: String(message.linkPreview.title || ''),
					description: String(message.linkPreview.description || ''),
					faviconUrl: String(message.linkPreview.faviconUrl || ''),
					imageUrl: String(message.linkPreview.imageUrl || ''),
					loading: false,
					url: linkPreview.url,
				});
			});
		};
		
		imageUrl ? node.addClass('withImage') : node.removeClass('withImage');
		this.show();
	};
	
	onClick (e: any) {
		const { linkPreview } = commonStore;
		ipcRenderer.send('urlOpen', linkPreview.url);			
	};
	
	onCopy (e: any) {
		const { linkPreview } = commonStore;
		
		Util.clipboardCopy({ text: linkPreview.url }, () => {
			alert('Link copied to clipboard!');
		});
		
		Util.linkPreviewHide(false);
	};
	
	onEdit (e: any) {
		const { linkPreview } = commonStore;
		const node = $(ReactDOM.findDOMNode(this));
		
		let { marks, range, onChange } = linkPreview;
		let mark = Mark.getInRange(marks, I.MarkType.Link, { from: range.from, to: range.to });
		
		commonStore.menuOpen('blockLink', {
			type: I.MenuType.Horizontal,
			element: linkPreview.element,
			offsetX: 0,
			offsetY: 0,
			vertical: I.MenuDirection.Top,
			horizontal: I.MenuDirection.Center,
			data: {
				value: (mark ? mark.param : ''),
				onChange: (param: string) => {
					param = Util.urlFix(param);
					marks = Mark.toggle(marks, { type: I.MarkType.Link, param: param, range: range });
					onChange(marks);
				}
			}
		});
		
		Util.linkPreviewHide(false);
	};
	
	onUnlink (e: any) {
		const { linkPreview } = commonStore;
		let { marks, range, onChange } =  linkPreview;
		
		marks = Mark.toggle(marks, { type: I.MarkType.Link, param: '', range: { from: range.from, to: range.to } });
		onChange(marks);
		
		Util.linkPreviewHide(false);
	};
	
	show () {
		const { linkPreview } = commonStore;
		const { element } = linkPreview;
		const win = $(window);
		const obj = $('#linkPreview');
		const poly = obj.find('.polygon');
		const ww = win.width();
		const wh = win.height();
		const dh = $(document).height();
		const st = win.scrollTop();
		const offset = element.offset();
		const nw = element.outerWidth();
		const nh = element.outerHeight();
		const ow = obj.outerWidth();
		const oh = obj.outerHeight();
		const oy = 4;
		const border = 12;
		const ps = (1 - nw / ow) / 2 * 100;
		const pe = ps + nw / ow * 100;
		
		obj.removeClass('top bottom');
		
		let css: any = { opacity: 0, left: 0, top: 0 };
		let typeY = I.MenuDirection.Bottom;
			
		poly.css({ top: 'auto', bottom: 'auto' });
			
		if (offset.top + oh + nh >= st + wh) {
			typeY = I.MenuDirection.Top;
		};
		
		if (typeY == I.MenuDirection.Top) {
			css.top = offset.top - oh - oy;
			obj.addClass('top');
				
			poly.css({ height: nh + oy, bottom: -nh - oy, clipPath: 'polygon(0% 0%, ' + ps + '% 100%, ' + pe + '% 100%, 100% 0%)' });
		};
			
		if (typeY == I.MenuDirection.Bottom) {
			css.top = offset.top + nh + oy;
			obj.addClass('bottom');
				
			poly.css({ height: nh + oy, top: -nh - oy, clipPath: 'polygon(0% 100%, ' + ps + '% 0%, ' + pe + '% 0%, 100% 100%)' });
		};
			
		css.left = offset.left - ow / 2 + nw / 2;
		css.left = Math.max(border, css.left);
		css.left = Math.min(ww - ow - border, css.left);
		
		obj.show().css(css);
		
		raf(() => { 
			obj.css({ opacity: 1 });
		});
	};
	
};

export default LinkPreview;