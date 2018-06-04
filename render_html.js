exports.tokenHtml = () => {
  return `
    <li>
      <button id="token-btn" class="btn btn-large btn-primary save-btn">Login to Github</button>
    </li>
  `;
};

exports.createView = (data) => {
    let li = '';

    data.forEach((issue) => {
      let labels = '';

      issue.labels.forEach((l) => {
        labels += `<span style="border-color: #${l.color};">${l.name}</span>`;
      });

      li += `<li class="list-group-item assigned">
          <a href="${issue.html_url}">
          <img class="img-circle media-object pull-left" src="${issue.repository.owner.avatar_url}" width="32" height="32">
          <div class="media-body">
            <span class="repository-title">${issue.repository.name}</span>
            <span class="issue-title"><strong>${issue.title}</strong></span>
            <p style="height: 28px; line-height: 28px;">
              <span>#${issue.number}</span>
              ${labels}
            </p>
          </div>
          </a>
        </li>`;
    });

    return li;
};

exports.errorMessage = () => {
  return '<p>Sorry something went wrong.</p>';
};
