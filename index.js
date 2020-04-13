const core = require('@actions/core');
const github = require('@actions/github');

const defaultIssueMessage = "Hi! Thanks for bringing this issue to the community's attention. This community welcomes you and looks forward to looking at your issue. In the mean feel free to join our Slack community for more updates.";
const defaultPrMessage = "Hi! Congrats on making your first pull request. The *insert repo name* community welcomes you and looks forward to looking at your contribution. In the meantime, please sign the CLA linked below and if you’d like, take a look at this file written for newer contributors.";

//helper functions
function isFirstIssue(client, owner, repo, sender, curIssueNumber) {
  return __awaiter(this, void 0, void 0, function* () {
      const { status, data: issues } = yield client.issues.listForRepo({
          owner: owner,
          repo: repo,
          creator: sender,
          state: 'all'
      });
      if (status !== 200) {
          throw new Error(`Received unexpected API status code ${status}`);
      }
      if (issues.length === 0) {
          return true;
      }
      for (const issue of issues) {
          if (issue.number < curIssueNumber && !issue.pull_request) {
              return false;
          }
      }
      return true;
  });
}

// No way to filter pulls by creator - todo - go through logic 
function isFirstPull(client, owner, repo, sender, curPullNumber, page = 1) {
  return __awaiter(this, void 0, void 0, function* () {
      // Provide console output if we loop for a while.
      console.log('Checking...');
      const { status, data: pulls } = yield client.pulls.list({
          owner: owner,
          repo: repo,
          per_page: 100,
          page: page,
          state: 'all'
      });
      if (status !== 200) {
          throw new Error(`Received unexpected API status code ${status}`);
      }
      if (pulls.length === 0) {
          return true;
      }
      for (const pull of pulls) {
          const login = pull.user.login;
          if (login === sender && pull.number < curPullNumber) {
              return false;
          }
      }
      return yield isFirstPull(client, owner, repo, sender, curPullNumber, page + 1);
  });
}


function run() {
  try {
    // obtain the inputs for the github action
    const repoToken = core.getInput('repo-token');
    const prMessage = core.getInput('pr-message');
    const issueMessage = core.getInput('issue-message');
    if (!prMessage) {
      prMessage = defaultPrMessage;
    }
    if (!issueMessage) {
      issueMessage = defaultIssueMessage;
    }

    // deleted { required: true }
    const client = new github.GitHub(core.getInput('repo-token'));
    const context = github.context;
    if (context.payload.action !== 'opened') {
        console.log('No issue or PR was opened, skipping');
        return;
    }

    // ensure payload is a pr or an issue
    if (!context.payload.issue && !context.payload.pull_request) {
      console.log('The event that triggered this action was not a pull request or issue, skipping.');
      return;
    }

    // return if there is no sender specified 
    if (!context.payload.sender) {
      throw new Error('Internal error, no sender provided by GitHub');
    }


    // check if this pr/issue is the "sender's" first
    const isIssue = context.payload.issue;
    const sender = context.payload.sender.login;
    const issue = context.issue;
    let firstContribution = false;
    if (isIssue) {
        firstContribution = yield isFirstIssue(client, issue.owner, issue.repo, sender, issue.number);
    }
    else {
        // why passing issue. ? instead of pulls
        firstContribution = yield isFirstPull(client, issue.owner, issue.repo, sender, issue.number);
    }
    console.log("first contribution value:");
    console.log(firstContribution);

    // temporarily commented out to allow for testing 
    // if (!firstContribution) {
    //     console.log('Not the users first contribution');
    //     return;
    // }

    // set the message
    const message = isIssue ? issueMessage : prMessage;

    // add a comment
    if (isIssue) {
      yield client.issues.createComment({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          body: message
      });
    }
    else {
        yield client.pulls.createReview({
            owner: issue.owner,
            repo: issue.repo,
            pull_number: issue.number,
            body: message,
            event: 'COMMENT'
        });
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}



run(); 