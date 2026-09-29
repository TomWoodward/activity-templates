import { h } from './dom.js';
import { activities, getActivity } from './activities/registry.js';
import { setPageMargins, DEFAULT_MARGINS } from './components/sheet.js';

const app = document.getElementById('app');

function renderIndex(container) {
  container.append(
    h('section', { class: 'index' },
      h('h1', {}, 'Activity types'),
      h('p', { class: 'lede' }, 'Pick an activity to build a printable worksheet.'),
      h('ul', { class: 'activity-list' },
        activities.map((activity) =>
          h('li', {},
            h('a', { class: 'activity-card', href: `#/${activity.id}` },
              h('span', { class: 'activity-card__name' }, activity.name),
              h('span', { class: 'activity-card__desc' }, activity.description),
            ),
          ),
        ),
      ),
    ),
  );
}

function route() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  const activity = id ? getActivity(id) : null;

  app.replaceChildren();
  setPageMargins(DEFAULT_MARGINS);
  if (activity) {
    document.title = `${activity.name} · Activity Templates`;
    activity.render(app);
  } else {
    document.title = 'Activity Templates';
    renderIndex(app);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
