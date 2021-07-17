var certificate = {};

$(async function() {
	const cert = $('#certificate');
	certificate.title = cert.attr('data-title');
	certificate.PNG = cert.attr('data-src') + '.png';
	certificate.PDF = cert.attr('data-src') + '.pdf';

	window.toast = window['toast-me'].default;

	$('.visible-pre-completion').prop('hidden', true);
	$('.visible-post-completion').prop('hidden', false);
	
	const handleSize = () => {
		cert.css({
			backgroundImage: `url('${certificate.PNG}')`,
			backgroundSize: 'cover'
		});
		const height = cert.attr('data-height');
		const width = cert.attr('data-width');
		if (height && width) {
			const computedWidth = $('#certificate-wrapper').width();
			const computedHeight = computedWidth * Number(height) / Number(width);
			if (width < computedWidth)
				cert.css({
					height: height,
					width: width
				});
			else
				cert.css({
					width: computedWidth,
					height: computedHeight
				});
		}
	};

	handleSize();
	$(window).on('resize', handleSize);

	// Social
	{
		const pageURL = window.location.href;
		const msg = `Hi! Here's my new certificate: ${certificate.title}`;
		const tags = ['Certificate', 'Rema'];
		
		$('#email').attr({
			href: ((subject, body) => {
				const mailURL = new URL('mailto:');
				mailURL.search = new URLSearchParams({
					subject,
					body
				});
				return mailURL;
			})(certificate.title, `${msg}.\n${pageURL}`)
		});
		$('#facebook').attr({
			href: (u => {
				const facebookURL = new URL('https://www.facebook.com/sharer/sharer.php');
				facebookURL.search = new URLSearchParams({
					u
				});
				return facebookURL;
			})(pageURL)
		});
		
		$('#twitter').attr({
			href: ((url, text, via, tags) => {
				const twitterURL = new URL('https://twitter.com/intent/tweet');
				twitterURL.search = new URLSearchParams({
					text,
					url,
					hashtags: tags.join(','),
					via,
					related: tags.join(',')
				});
				return twitterURL;
			})(pageURL, msg, 'ParamSiddharth', tags)
		});
		$('#linkedin').attr({
			href: ((url, title, source) => {
				const linkedURL = new URL('https://www.linkedin.com/sharing/share-offsite');
				linkedURL.search = new URLSearchParams({
					url,
					title,
					source
				});
				return linkedURL;
			})(pageURL, certificate.title, 'Rema by Param Siddharth')
		});
	}
});

const downloadCert = async type => {
	const msg = `Downloading ${type}...`;
	console.log(msg);
	window.toast(msg, {
		toastClass: 'bg-toast float-right',
		duration: 2000
	});
};