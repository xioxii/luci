'use strict';
'require view';
'require fs';
'require ui';

/* MT6890_LOG_VIEW_FILTER: hide only known repetitive diagnostics in LuCI views.
 * Raw dmesg/logread data remains available via the 'Show all logs' checkbox.
 */
function filterMt6890LogLines(lines) {
    var noisyPatterns = [
        /\[SPM\]\s*MCUSYSOFF wake up by\b/,
        /\[ccci[0-9]+\/net\].*\brx=\(/,
        /MT6890_ETH_RX_RING_SIZE:/,
        /MT6890_ETH_RX_IRQ_ARMED:/
    ];
    var visible = [];
    var hidden = 0;

    lines.forEach(function(line) {
        var isNoisy = noisyPatterns.some(function(pattern) {
            return pattern.test(line);
        });
        if (isNoisy)
            hidden++;
        else
            visible.push(line);
    });

    return { lines: visible, hidden: hidden };
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/usr/sbin/logread'), null)
		]).then(function(stat) {
			var logger = stat[0] ? stat[0].path : stat[1] ? stat[1].path : null;

			return fs.exec_direct(logger, [ '-e', '^' ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			});
		});
	},

	render: function(logdata) {
		var rawLines = logdata ? logdata.replace(/\r/g, '').trim().split(/\n/) : [];
		var filtered = filterMt6890LogLines(rawLines);
		var textarea = E('textarea', {
			'id': 'syslog',
			'style': 'font-size:12px',
			'readonly': 'readonly',
			'wrap': 'off',
			'rows': Math.max(10, filtered.lines.length + 1)
		}, [ filtered.lines.join('\n') ]);
		var status = E('span', {}, [ _('Filtered repetitive diagnostic lines: ') + filtered.hidden ]);
		var showAll = E('input', {
			'type': 'checkbox',
			'change': function(ev) {
				var checked = ev.target.checked;
				var shown = checked ? rawLines : filtered.lines;
				textarea.value = shown.join('\n');
				textarea.rows = Math.max(10, shown.length + 1);
				status.textContent = checked
					? _('Showing all system log lines (unfiltered).')
					: _('Filtered repetitive diagnostic lines: ') + filtered.hidden;
			}
		});

		return E([], [
			E('h2', {}, [ _('System Log') ]),
			E('p', {}, [
				E('label', {}, [ showAll, ' ', _('Show all logs (unfiltered)') ]),
				' ', status
			]),
			E('div', { 'id': 'content_syslog' }, [ textarea ])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
